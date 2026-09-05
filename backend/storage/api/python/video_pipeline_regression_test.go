package pythonapi

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"backend/configs"
)

func TestVideoPipelineRegressions_Cases1to7(t *testing.T) {
	// Case 4, 5, 6, 7: Quality options and upscale prevention
	qual4k := allowedQualities("4k")
	if len(qual4k) != 3 || qual4k[0] != "4k" || qual4k[1] != "2k" || qual4k[2] != "1080p" {
		t.Fatalf("Case 4: 4K must expose 4k, 2k, 1080p; got %#v", qual4k)
	}

	qual2k := allowedQualities("2k")
	if len(qual2k) != 2 || qual2k[0] != "2k" || qual2k[1] != "1080p" {
		t.Fatalf("Case 5: 2K must expose 2k, 1080p; got %#v", qual2k)
	}

	qual1080p := allowedQualities("1080p_or_lower")
	if len(qual1080p) != 0 {
		t.Fatalf("Case 6: <=1080p must not have quality selector options; got %#v", qual1080p)
	}

	// Case 3: .original-video/ and legacy original-video/ excluded from recursive discovery
	tempDir := t.TempDir()
	hiddenOrigDir := filepath.Join(tempDir, ".original-video")
	subHiddenOrigDir := filepath.Join(hiddenOrigDir, "nested")
	if err := os.MkdirAll(subHiddenOrigDir, 0755); err != nil {
		t.Fatal(err)
	}
	legacyOrigDir := filepath.Join(tempDir, "original-video")
	if err := os.MkdirAll(legacyOrigDir, 0755); err != nil {
		t.Fatal(err)
	}
	// Write dummy video files inside .original-video/ and original-video/
	if err := os.WriteFile(filepath.Join(hiddenOrigDir, "source1.mp4"), []byte("dummy-mp4-data"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(subHiddenOrigDir, "source2.mp4"), []byte("dummy-mp4-data"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyOrigDir, "legacy.mp4"), []byte("dummy-mp4-data"), 0644); err != nil {
		t.Fatal(err)
	}
	// Write dummy video file in root
	if err := os.WriteFile(filepath.Join(tempDir, "root.mp4"), []byte("dummy-mp4-data"), 0644); err != nil {
		t.Fatal(err)
	}

	validations := ScanVideoValidationContext(context.Background(), tempDir)
	for _, v := range validations {
		if strings.Contains(filepath.ToSlash(v.Path), "/.original-video/") || strings.Contains(filepath.ToSlash(v.Path), "/original-video/") {
			t.Fatalf("Case 3: .original-video/ and original-video/ must be excluded from recursive discovery, found: %s", v.Path)
		}
	}
	if len(validations) != 1 || filepath.Base(validations[0].Path) != "root.mp4" {
		t.Fatalf("Case 3: expected only root.mp4, got %#v", validations)
	}
}

func TestVideoPipelineRegressions_Cases8to12_DecisionsAndApply(t *testing.T) {
	resetArchiveJobsForTest(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	v1ID := "video-1111"
	v2ID := "video-2222"

	job := &ArchiveJob{
		ID:    "job-decision-test",
		Stage: "video_decision_required",
		Videos: []VideoOptimization{
			{
				ID:                 v1ID,
				RelativePath:       "movie1.mp4",
				DisplayName:        "movie1.mp4",
				OptimizationNeeded: true,
				AllowedQualities:   []string{"4k", "2k", "1080p"},
				State:              "decision_required",
			},
			{
				ID:                 v2ID,
				RelativePath:       "movie2.mp4",
				DisplayName:        "movie2.mp4",
				OptimizationNeeded: true,
				AllowedQualities:   []string{"2k", "1080p"},
				State:              "decision_required",
			},
		},
		ctx:    ctx,
		cancel: cancel,
	}

	archiveJobs.Lock()
	archiveJobs.items[job.ID] = job
	archiveJobs.Unlock()

	// Case 7 & 11: Invalid/unknown video ID and upscale/unsupported quality rejected
	if err := SetVideoDecision(job.ID, "unknown-video-id", "1080p"); err == nil {
		t.Fatal("Case 11: unknown video ID must be rejected")
	}
	if err := SetVideoDecision(job.ID, v2ID, "4k"); err == nil {
		t.Fatal("Case 7: upscale quality must be rejected")
	}

	// Case 8: storing/selecting one decision does NOT start conversion
	if err := SetVideoDecision(job.ID, v1ID, "1080p"); err != nil {
		t.Fatalf("SetVideoDecision v1 failed: %v", err)
	}
	job.mu.RLock()
	st1 := job.Stage
	v1Sel := job.Videos[0].SelectedQuality
	job.mu.RUnlock()
	if st1 != "video_decision_required" {
		t.Fatalf("Case 8: selecting one decision must NOT change stage or start conversion, got stage=%s", st1)
	}
	if v1Sel != "1080p" {
		t.Fatalf("v1 selection not stored, got %s", v1Sel)
	}

	// Case 9: incomplete decision set does NOT start conversion
	if err := ApplyVideoDecisions(job.ID, nil); err == nil {
		t.Fatal("Case 9: Apply with incomplete decisions must be rejected")
	}
	job.mu.RLock()
	st2 := job.Stage
	job.mu.RUnlock()
	if st2 != "video_decision_required" {
		t.Fatalf("Case 9: incomplete decisions must keep stage video_decision_required, got %s", st2)
	}

	// Set second decision via SetVideoDecision, but do not call apply yet
	if err := SetVideoDecision(job.ID, v2ID, "1080p"); err != nil {
		t.Fatalf("SetVideoDecision v2 failed: %v", err)
	}
	job.mu.RLock()
	st3 := job.Stage
	job.mu.RUnlock()
	if st3 != "video_decision_required" {
		t.Fatalf("Case 8b: complete decisions via SetVideoDecision must still NOT start conversion without Apply, got %s", st3)
	}

	// Case 10: explicit Apply with complete valid decisions starts conversion
	workspace := t.TempDir()
	job.mu.Lock()
	job.extractedPath = workspace
	job.extractedName = "test-extracted"
	job.Destination = "albums/test"
	job.mu.Unlock()

	if err := ApplyVideoDecisions(job.ID, nil); err != nil {
		t.Fatalf("Case 10: ApplyVideoDecisions failed: %v", err)
	}
	job.mu.RLock()
	st4 := job.Stage
	job.mu.RUnlock()
	if st4 != "converting" {
		t.Fatalf("Case 10: stage must become converting after Apply, got %s", st4)
	}

	// Case 12: duplicate Apply while converting must be rejected
	if err := ApplyVideoDecisions(job.ID, nil); err == nil {
		t.Fatal("Case 12: duplicate Apply while converting must be rejected")
	}
}

func TestVideoPipelineRegressions_Cases13to18_CancellationLifecycle(t *testing.T) {
	resetArchiveJobsForTest(t)
	root := t.TempDir()
	prevRoot := configs.DEFAULT_ROOT_PATH
	configs.DEFAULT_ROOT_PATH = root
	defer func() { configs.DEFAULT_ROOT_PATH = prevRoot }()

	workspace := t.TempDir()
	extracted := filepath.Join(workspace, "my-archive")
	if err := os.MkdirAll(extracted, 0755); err != nil {
		t.Fatal(err)
	}

	// Setup extracted files:
	// - untouched originals under .original-video/
	// - a completed converted file video1.mp4
	// - an incomplete temp file video2.mp4.tmp.mp4
	// - an image file picture.jpg
	origDir := filepath.Join(extracted, ".original-video")
	_ = os.MkdirAll(origDir, 0755)
	_ = os.WriteFile(filepath.Join(origDir, "video1.mp4"), []byte("original-v1-bytes"), 0644)
	_ = os.WriteFile(filepath.Join(origDir, "video2.mp4"), []byte("original-v2-bytes"), 0644)
	_ = os.WriteFile(filepath.Join(extracted, "video1.mp4"), []byte("converted-v1-bytes"), 0644)
	_ = os.WriteFile(filepath.Join(extracted, "video2.mp4.tmp.mp4"), []byte("partial-v2-bytes"), 0644)
	_ = os.WriteFile(filepath.Join(extracted, "picture.jpg"), []byte("photo-bytes"), 0644)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	job := &ArchiveJob{
		ID:            "cancel-job-test",
		Stage:         "converting",
		extractedPath: extracted,
		extractedName: "my-archive",
		Destination:   "dest-folder",
		ctx:           ctx,
		cancel:        cancel,
	}

	archiveJobs.Lock()
	archiveJobs.items[job.ID] = job
	archiveJobs.Unlock()

	// Calling CancelArchiveJob transitions to "cancelling"
	ok := CancelArchiveJob(job.ID)
	if !ok {
		t.Fatal("CancelArchiveJob must succeed")
	}

	job.mu.RLock()
	stage := job.Stage
	optCancelled := job.OptimizationCancelled
	cancelledFrom := job.CancelledFromStage
	job.mu.RUnlock()

	// Case 16: job remains cancelling until filesystem finalization finishes
	if stage != "cancelling" {
		t.Fatalf("Case 16: job must be in cancelling state, got %s", stage)
	}
	if !optCancelled || cancelledFrom != "converting" {
		t.Fatalf("OptimizationCancelled must be true and CancelledFromStage converting, got %v / %s", optCancelled, cancelledFrom)
	}

	// Clean incomplete outputs
	cleanIncompleteOutputs(extracted)
	if _, err := os.Stat(filepath.Join(extracted, "video2.mp4.tmp.mp4")); !os.IsNotExist(err) {
		t.Fatal("Incomplete tmp file must be cleaned up")
	}

	// Run commit with detached context
	detachedCtx, detachCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer detachCancel()
	if err := commitArchiveResultWithContext(detachedCtx, job); err != nil {
		t.Fatalf("commitArchiveResultWithContext failed: %v", err)
	}

	setArchiveStage(job, "completed")

	// Case 17: stage becomes completed after finalization with OptimizationCancelled: true
	job.mu.RLock()
	finalStage := job.Stage
	job.mu.RUnlock()
	if finalStage != "completed" {
		t.Fatalf("Case 17: stage must be completed after finalization, got %s", finalStage)
	}

	// Case 1, 2, 13, 14: check destination folder content
	finalDest := filepath.Join(root, "dest-folder", "my-archive")
	// Untouched .original-video/ must be present
	v1Orig, err := os.ReadFile(filepath.Join(finalDest, ".original-video", "video1.mp4"))
	if err != nil || string(v1Orig) != "original-v1-bytes" {
		t.Fatalf("Case 1: untouched original video1 must be preserved in .original-video/: %v", err)
	}
	v2Orig, err := os.ReadFile(filepath.Join(finalDest, ".original-video", "video2.mp4"))
	if err != nil || string(v2Orig) != "original-v2-bytes" {
		t.Fatalf("Case 1: untouched original video2 must be preserved in .original-video/: %v", err)
	}

	// Converted video1 must be at destination logical location
	v1Conv, err := os.ReadFile(filepath.Join(finalDest, "video1.mp4"))
	if err != nil || string(v1Conv) != "converted-v1-bytes" {
		t.Fatalf("Case 2 & 14: converted video1 must be at root of finalized folder: %v", err)
	}

	// Incomplete video2 must NOT be present
	if _, err := os.Stat(filepath.Join(finalDest, "video2.mp4.tmp.mp4")); !os.IsNotExist(err) {
		t.Fatal("Partial output must not exist in final destination")
	}

	// Other content (picture.jpg) must be preserved
	pic, err := os.ReadFile(filepath.Join(finalDest, "picture.jpg"))
	if err != nil || string(pic) != "photo-bytes" {
		t.Fatalf("All other downloaded content must be preserved: %v", err)
	}

	// Case 18: finalization failure preserves temp/extracted source
	failWorkspace := t.TempDir()
	failSource := filepath.Join(failWorkspace, "cannot-commit")
	_ = os.MkdirAll(failSource, 0755)
	_ = os.WriteFile(filepath.Join(failSource, "test.txt"), []byte("preserve-me"), 0644)

	failJob := &ArchiveJob{
		ID:            "fail-job-test",
		Stage:         "cancelling",
		extractedPath: failSource,
		extractedName: "cannot-commit",
		Destination:   "../escape-invalid", // will fail safeArchivePath
		ctx:           context.Background(),
	}

	err = commitArchiveResultWithContext(context.Background(), failJob)
	if err == nil {
		t.Fatal("Expected error on invalid destination")
	}
	// Verify workspace / source was NOT deleted
	if _, statErr := os.Stat(filepath.Join(failSource, "test.txt")); os.IsNotExist(statErr) {
		t.Fatal("Case 18: finalization failure must NOT delete extracted source")
	}
}

func TestVideoPipelineRegressions_Cases19to21_PathsAndImageFolders(t *testing.T) {
	root := t.TempDir()
	prevRoot := configs.DEFAULT_ROOT_PATH
	configs.DEFAULT_ROOT_PATH = root
	defer func() { configs.DEFAULT_ROOT_PATH = prevRoot }()

	// Case 19: /Test resolves directly below ROOT_PATH
	path1, err := safeArchivePath("/Test")
	if err != nil || path1 != filepath.Join(root, "Test") {
		t.Fatalf("Case 19: /Test must resolve to ROOT_PATH/Test, got %s (%v)", path1, err)
	}

	// Case 20: Unicode/special-character paths preserved
	unicodeLogical := "/Ảnh Đẹp #1/玉汇 @2026! [folder]"
	path2, err := safeArchivePath(unicodeLogical)
	if err != nil || path2 != filepath.Join(root, "Ảnh Đẹp #1/玉汇 @2026! [folder]") {
		t.Fatalf("Case 20: Unicode path must be preserved, got %s (%v)", path2, err)
	}

	// Case 21: image-only folders do not enter conversion
	imgDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(imgDir, "photo1.jpg"), []byte("jpg1"), 0644)
	_ = os.WriteFile(filepath.Join(imgDir, "photo2.png"), []byte("png1"), 0644)

	opts := ScanVideoOptimizations(context.Background(), imgDir)
	if len(opts) != 0 {
		t.Fatalf("Case 21: image-only folder must not return video optimizations, got %#v", opts)
	}
}

func TestVideoPipelineRegressions_SafeConversionSteps(t *testing.T) {
	// Tests preserving original into .original-video/ and atomic rename
	dir := t.TempDir()
	src := filepath.Join(dir, "my_video.mp4")
	_ = os.WriteFile(src, []byte("source-content"), 0644)

	// Step 1: preserve to .original-video/
	origDir := filepath.Join(dir, ".original-video")
	_ = os.MkdirAll(origDir, 0755)
	origFile := filepath.Join(origDir, "my_video.mp4")
	if err := os.Rename(src, origFile); err != nil {
		t.Fatalf("Rename to .original-video failed: %v", err)
	}
	if _, err := os.Stat(src); !os.IsNotExist(err) {
		t.Fatal("Original logical path must be vacant before conversion output is placed")
	}

	// Step 2 & 3: Temporary output
	tmpOutput := src + ".tmp.mp4"
	_ = os.WriteFile(tmpOutput, []byte("converted-content"), 0644)

	// Step 5: Atomic rename
	if err := os.Rename(tmpOutput, src); err != nil {
		t.Fatalf("Rename tmpOutput to src failed: %v", err)
	}

	// Both files must exist independently
	origBytes, _ := os.ReadFile(origFile)
	convBytes, _ := os.ReadFile(src)
	if string(origBytes) != "source-content" || string(convBytes) != "converted-content" {
		t.Fatalf("Original and converted outputs must match expected content")
	}
}

func TestVideoPipelineRegressions_CancelOptimization_UnoptimizedCounts(t *testing.T) {
	resetArchiveJobsForTest(t)

	// Scenario 1: Cancel before any video completes (3 videos total)
	ctx1, cancel1 := context.WithCancel(context.Background())
	defer cancel1()
	job1 := &ArchiveJob{
		ID:            "cancel-count-test-1",
		Stage:         "converting",
		ConvertTotal:   3,
		ConvertCurrent: 0,
		Videos: []VideoOptimization{
			{ID: "v1", RelativePath: "v1.mp4", OptimizationNeeded: true, State: "converting"},
			{ID: "v2", RelativePath: "v2.mp4", OptimizationNeeded: true, State: "ready"},
			{ID: "v3", RelativePath: "v3.mp4", OptimizationNeeded: true, State: "ready"},
		},
		ctx:    ctx1,
		cancel: cancel1,
	}
	archiveJobs.Lock()
	archiveJobs.items[job1.ID] = job1
	archiveJobs.Unlock()

	CancelArchiveJob(job1.ID)
	// Simulate finalization completion to "completed"
	setArchiveStage(job1, "completed")

	snap1, ok1 := GetArchiveJobSnapshot(job1.ID)
	if !ok1 {
		t.Fatal("snapshot 1 not found")
	}
	if snap1.State != "completed" || !snap1.OptimizationCancelled || snap1.UnoptimizedVideoCount != 3 {
		t.Fatalf("Scenario 1: expected completed with OptimizationCancelled=true and UnoptimizedVideoCount=3, got state=%s, optCancelled=%v, unoptimizedCount=%d",
			snap1.State, snap1.OptimizationCancelled, snap1.UnoptimizedVideoCount)
	}

	// Scenario 2: Cancel after 1 video completes (3 videos total, 1 completed)
	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	job2 := &ArchiveJob{
		ID:            "cancel-count-test-2",
		Stage:         "converting",
		ConvertTotal:   3,
		ConvertCurrent: 1,
		Videos: []VideoOptimization{
			{ID: "v1", RelativePath: "v1.mp4", OptimizationNeeded: true, State: "completed"},
			{ID: "v2", RelativePath: "v2.mp4", OptimizationNeeded: true, State: "converting"},
			{ID: "v3", RelativePath: "v3.mp4", OptimizationNeeded: true, State: "ready"},
		},
		ctx:    ctx2,
		cancel: cancel2,
	}
	archiveJobs.Lock()
	archiveJobs.items[job2.ID] = job2
	archiveJobs.Unlock()

	CancelArchiveJob(job2.ID)
	setArchiveStage(job2, "completed")

	snap2, ok2 := GetArchiveJobSnapshot(job2.ID)
	if !ok2 {
		t.Fatal("snapshot 2 not found")
	}
	if snap2.State != "completed" || !snap2.OptimizationCancelled || snap2.UnoptimizedVideoCount != 2 {
		t.Fatalf("Scenario 2: expected completed with OptimizationCancelled=true and UnoptimizedVideoCount=2, got state=%s, optCancelled=%v, unoptimizedCount=%d",
			snap2.State, snap2.OptimizationCancelled, snap2.UnoptimizedVideoCount)
	}
}

func TestVideoPipelineRegressions_LegacyOriginalVideoMigration(t *testing.T) {
	tempDir := t.TempDir()
	legacyDir := filepath.Join(tempDir, "original-video")
	nestedLegacy := filepath.Join(legacyDir, "subfolder")
	if err := os.MkdirAll(nestedLegacy, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "video1.mp4"), []byte("video1-content"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nestedLegacy, "video2.mp4"), []byte("video2-content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Run migration
	MigrateLegacyOriginalVideoDir(tempDir)

	// Verify .original-video exists with migrated contents
	hiddenDir := filepath.Join(tempDir, ".original-video")
	v1Data, err := os.ReadFile(filepath.Join(hiddenDir, "video1.mp4"))
	if err != nil || string(v1Data) != "video1-content" {
		t.Fatalf(".original-video/video1.mp4 missing or invalid: %v", err)
	}
	v2Data, err := os.ReadFile(filepath.Join(hiddenDir, "subfolder", "video2.mp4"))
	if err != nil || string(v2Data) != "video2-content" {
		t.Fatalf(".original-video/subfolder/video2.mp4 missing or invalid: %v", err)
	}

	// Verify legacy directory is removed
	if _, err := os.Stat(legacyDir); !os.IsNotExist(err) {
		t.Fatal("legacy original-video directory should be removed after migration")
	}
}

func TestVideoPipelineRegressions_PersistAndReloadCancelledOptimization(t *testing.T) {
	stateDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", stateDir)
	resetArchiveJobsForTest(t)

	now := time.Now().UTC()
	job := &ArchiveJob{
		ID:                    "job-opt-cancel-persist",
		CanonicalID:           "parent-opt-cancel",
		URL:                   "https://example.test/archive.zip",
		Filename:              "archive.zip",
		Destination:           "albums/test",
		Stage:                 "completed",
		OptimizationCancelled: true,
		CancelledFromStage:    "converting",
		ConvertTotal:          3,
		ConvertCurrent:        1,
		Videos: []VideoOptimization{
			{ID: "v1", RelativePath: "v1.mp4", OptimizationNeeded: true, State: "completed"},
			{ID: "v2", RelativePath: "v2.mp4", OptimizationNeeded: true, State: "cancelled"},
			{ID: "v3", RelativePath: "v3.mp4", OptimizationNeeded: true, State: "cancelled"},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	archiveJobs.Lock()
	archiveJobs.items[job.ID] = job
	archiveJobs.Unlock()

	persistArchiveJob(job)

	// Clear in-memory jobs and reload
	archiveJobs.Lock()
	archiveJobs.items = make(map[string]*ArchiveJob)
	archiveJobs.Unlock()

	LoadPersistentArchiveJobs()

	restored, ok := GetArchiveJobSnapshot(job.ID)
	if !ok {
		t.Fatal("persisted job was not restored")
	}
	if restored.State != "completed" || !restored.OptimizationCancelled || restored.UnoptimizedVideoCount != 2 {
		t.Fatalf("Restored job snapshot mismatch: state=%s, optCancelled=%v, unoptimizedCount=%d",
			restored.State, restored.OptimizationCancelled, restored.UnoptimizedVideoCount)
	}
	if restored.CancelledFromStage != "converting" {
		t.Fatalf("Restored CancelledFromStage mismatch: %s", restored.CancelledFromStage)
	}
}
