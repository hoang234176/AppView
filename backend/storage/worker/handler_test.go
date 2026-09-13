package worker

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	pythonapi "backend/api/python"
	"backend/media_download/facebook"
	"backend/media_download/instagram"
	"backend/media_download/youtube"
)

type fakeArchiveOperations struct {
	startErr          error
	startSnapshot     *pythonapi.ArchiveJobSnapshot
	started           bool
	retried           bool
	extractionRetried bool
	snapshots         map[string]pythonapi.ArchiveJobSnapshot
}

func (f *fakeArchiveOperations) Start(id, _, _, _, _ string) error {
	f.started = true
	if f.startErr == nil && f.startSnapshot != nil {
		if f.snapshots == nil {
			f.snapshots = make(map[string]pythonapi.ArchiveJobSnapshot)
		}
		snapshot := *f.startSnapshot
		snapshot.ID = id
		f.snapshots[id] = snapshot
	}
	return f.startErr
}

func (f *fakeArchiveOperations) Retry(_, _ string) error { f.retried = true; return f.startErr }
func (f *fakeArchiveOperations) RetryExtraction(_, _ string) error {
	f.extractionRetried = true
	return f.startErr
}
func (f *fakeArchiveOperations) Cancel(id string) bool {
	_, ok := f.snapshots[id]
	return ok
}

func (f *fakeArchiveOperations) Delete(id string) bool {
	delete(f.snapshots, id)
	return true
}

func (f *fakeArchiveOperations) Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool) {
	snapshot, ok := f.snapshots[id]
	return snapshot, ok
}

func (f *fakeArchiveOperations) Snapshots() []pythonapi.ArchiveJobSnapshot {
	result := make([]pythonapi.ArchiveJobSnapshot, 0, len(f.snapshots))
	for _, snapshot := range f.snapshots {
		result = append(result, snapshot)
	}
	return result
}

func collect(messages *[]Message) SendFunc {
	return func(message Message) error {
		*messages = append(*messages, message)
		return nil
	}
}

func completedSnapshot(id string) pythonapi.ArchiveJobSnapshot {
	return pythonapi.ArchiveJobSnapshot{ID: id, State: "completed", Filename: "archive.zip"}
}

func TestHandlerRegistersOnlyDownloadCapability(t *testing.T) {
	handler := NewHandler(&fakeArchiveOperations{})
	capabilities := handler.Capabilities()
	if len(capabilities) != 1 || capabilities[0] != CapabilityDownloadFile {
		t.Fatalf("capabilities = %#v, want only %q", capabilities, CapabilityDownloadFile)
	}
}

func TestHandlerCompletesExistingArchiveJob(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"task-1": completedSnapshot("task-1"),
	}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-1", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if archive.started {
		t.Fatal("existing archive job must be monitored, not started again")
	}
	if len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want accepted, history, completed", sent)
	}
}

func TestHandlerStartsExistingArchiveServiceAndMapsCompleted(t *testing.T) {
	snapshot := completedSnapshot("")
	archive := &fakeArchiveOperations{startSnapshot: &snapshot}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-start", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if !archive.started || len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want existing service accepted, history, completed", sent)
	}
}

func TestHandlerFailsInvalidPayloadAndUnsupportedAction(t *testing.T) {
	handler := NewHandler(&fakeArchiveOperations{})
	for _, task := range []Message{
		{Type: TaskAssign, TaskID: "invalid", Action: CapabilityDownloadFile, Payload: []byte(`{}`)},
		{Type: TaskAssign, TaskID: "unsupported", Action: "convert_video", Payload: []byte(`{}`)},
	} {
		var sent []Message
		handler.Handle(context.Background(), task, collect(&sent))
		if len(sent) != 1 || sent[0].Type != TaskFailed {
			t.Fatalf("messages = %#v, want one task.failed", sent)
		}
	}
}

func TestHandlerRetriesExistingArchiveWithoutStartingAnotherDownload(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"archive-1": completedSnapshot("archive-1"),
	}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "control-1", Action: CapabilityDownloadFile,
		Payload: []byte(`{"operation":"extract","archiveTaskId":"archive-1","password":"not logged"}`),
	}, collect(&sent))
	if archive.started || !archive.extractionRetried {
		t.Fatalf("control must retry extraction only: started=%v retried=%v", archive.started, archive.extractionRetried)
	}
	if len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want accepted, history, completed", sent)
	}
}

func TestHandlerMapsStartFailureToTaskFailed(t *testing.T) {
	archive := &fakeArchiveOperations{startErr: errors.New("disk unavailable"), snapshots: map[string]pythonapi.ArchiveJobSnapshot{}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-2", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if !archive.started || len(sent) != 2 || sent[0].Type != TaskAccepted || sent[1].Error.Code != "STORAGE_START_FAILED" {
		t.Fatalf("messages = %#v, want accepted then STORAGE_START_FAILED", sent)
	}
}

func TestHandlerCancellationStopsMonitoringWithoutCancellingArchive(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"task-3": {ID: "task-3", State: "downloading", Filename: "archive.zip"},
	}}
	handler := NewHandler(archive)
	handler.pollInterval = time.Hour
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	finished := make(chan struct{})
	go func() {
		handler.Handle(ctx, Message{
			Type: TaskAssign, TaskID: "task-3", Action: CapabilityDownloadFile,
			Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
		}, func(Message) error { return nil })
		close(finished)
	}()

	time.Sleep(5 * time.Millisecond)
	cancel()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("handler did not stop after context cancellation")
	}
	if archive.started {
		t.Fatal("existing archive job must not be cancelled or restarted on worker shutdown")
	}
}

type fakeYouTubeOperations struct {
	started   bool
	cancelled bool
	decided   bool
	applied   bool
	snapshots map[string]youtube.Snapshot
}

func (f *fakeYouTubeOperations) Start(id, sourceURL, filename, destination, audioURL string, headers map[string]string) error {
	f.started = true
	if f.snapshots == nil {
		f.snapshots = make(map[string]youtube.Snapshot)
	}
	f.snapshots[id] = youtube.Snapshot{
		ID:       id,
		State:    "completed",
		Filename: filename,
	}
	return nil
}

func (f *fakeYouTubeOperations) Cancel(id string) bool {
	f.cancelled = true
	return true
}

func (f *fakeYouTubeOperations) Delete(id string) bool {
	delete(f.snapshots, id)
	return true
}

func (f *fakeYouTubeOperations) SetVideoDecision(id, videoID, quality string) error {
	f.decided = true
	return nil
}

func (f *fakeYouTubeOperations) ApplyVideoDecisions(id string, decisions map[string]string) error {
	f.applied = true
	return nil
}

func (f *fakeYouTubeOperations) Snapshot(id string) (youtube.Snapshot, bool) {
	s, ok := f.snapshots[id]
	return s, ok
}

func (f *fakeYouTubeOperations) Snapshots() []youtube.Snapshot {
	res := make([]youtube.Snapshot, 0, len(f.snapshots))
	for _, s := range f.snapshots {
		res = append(res, s)
	}
	return res
}

func (f *fakeYouTubeOperations) SetCanonicalID(id, canonicalID string) bool {
	return true
}

func TestHandlerRoutesYouTubeTaskToYouTubeOperations(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{}}
	yt := &fakeYouTubeOperations{snapshots: map[string]youtube.Snapshot{}}
	handler := NewHandler(archive, yt)
	handler.pollInterval = time.Millisecond

	var sent []Message
	handler.Handle(context.Background(), Message{
		Type:   TaskAssign,
		TaskID: "yt-task-1",
		Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://rr1---sn-example.googlevideo.com/videoplayback","filename":"video.mp4","source":"youtube"}`),
	}, collect(&sent))

	if !yt.started {
		t.Fatal("YouTube task was NOT routed to youtube operations")
	}
	if archive.started {
		t.Fatal("YouTube task was unexpectedly routed to archive operations!")
	}

	// Test control delegation to YouTube
	ytControl := &fakeYouTubeOperations{
		snapshots: map[string]youtube.Snapshot{
			"yt-task-2": {ID: "yt-task-2", State: "video_decision_required"},
		},
	}
	handlerControl := NewHandler(archive, ytControl)
	var controlSent []Message

	handlerControl.Handle(context.Background(), Message{
		Type:   TaskAssign,
		TaskID: "control-1",
		Action: CapabilityDownloadFile,
		Payload: []byte(`{"operation":"video_apply","archiveTaskId":"yt-task-2","decisions":{"vid1":"1080p"}}`),
	}, collect(&controlSent))

	if !ytControl.applied {
		t.Fatal("video_apply was not delegated to YouTube operations")
	}
}

func TestHandlerRoutesArchiveTaskToArchiveOperations(t *testing.T) {
	archive := &fakeArchiveOperations{
		snapshots: map[string]pythonapi.ArchiveJobSnapshot{},
		startSnapshot: &pythonapi.ArchiveJobSnapshot{
			State: "completed",
		},
	}
	yt := &fakeYouTubeOperations{snapshots: map[string]youtube.Snapshot{}}
	handler := NewHandler(archive, yt)
	handler.pollInterval = time.Millisecond

	var sent []Message
	handler.Handle(context.Background(), Message{
		Type:   TaskAssign,
		TaskID: "archive-task-1",
		Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://download.mediafire.com/file.zip","filename":"file.zip"}`),
	}, collect(&sent))

	if !archive.started {
		t.Fatal("Archive task was NOT routed to archive operations")
	}
	if yt.started {
		t.Fatal("Archive task was unexpectedly routed to youtube operations!")
	}
}

func TestHandlerCookieMessages(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	handler := NewHandler(nil, nil)

	// 1. Initial status query
	var sent []Message
	handler.HandleCookieMessage(Message{
		Type:    CookieStatus,
		TaskID:  "task-status-1",
		Payload: []byte(`{"platform":"youtube"}`),
	}, collect(&sent))

	if len(sent) != 1 || sent[0].Type != CookieStatus {
		t.Fatalf("expected CookieStatus response, got %+v", sent)
	}
	statusRes, ok := sent[0].Result.(CookieStatusResult)
	if !ok || statusRes.Exists {
		t.Fatalf("expected exists=false, got %+v", sent[0].Result)
	}

	// 2. Save cookies
	sent = nil
	sampleCookies := "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2147483647\tTEST\tVALUE\n"
	savePayload, _ := json.Marshal(CookieRequestPayload{Platform: "youtube", Cookies: sampleCookies})
	handler.HandleCookieMessage(Message{
		Type:    CookieSave,
		TaskID:  "task-save-1",
		Payload: savePayload,
	}, collect(&sent))

	if len(sent) != 1 || sent[0].Type != CookieSave {
		t.Fatalf("expected CookieSave response, got %+v", sent)
	}
	saveRes, ok := sent[0].Result.(CookieSaveResult)
	if !ok || !saveRes.Success {
		t.Fatalf("expected success=true, got %+v", sent[0].Result)
	}

	// 3. Status query after save
	sent = nil
	handler.HandleCookieMessage(Message{
		Type:    CookieStatus,
		TaskID:  "task-status-2",
		Payload: []byte(`{"platform":"youtube"}`),
	}, collect(&sent))

	if len(sent) != 1 || sent[0].Type != CookieStatus {
		t.Fatalf("expected CookieStatus response, got %+v", sent)
	}
	statusRes, ok = sent[0].Result.(CookieStatusResult)
	if !ok || !statusRes.Exists || statusRes.UpdatedAt == nil {
		t.Fatalf("expected exists=true with non-nil updated_at, got %+v", sent[0].Result)
	}

	// 4. Get cookies
	sent = nil
	handler.HandleCookieMessage(Message{
		Type:    CookieGet,
		TaskID:  "task-get-1",
		Payload: []byte(`{"platform":"youtube"}`),
	}, collect(&sent))

	if len(sent) != 1 || sent[0].Type != CookieGet {
		t.Fatalf("expected CookieGet response, got %+v", sent)
	}
	getRes, ok := sent[0].Result.(CookieGetResult)
	if !ok || !getRes.Exists || getRes.Cookies != sampleCookies {
		t.Fatalf("expected matches sample cookies, got %+v", sent[0].Result)
	}
}

type fakeFacebookOperations struct {
	started   bool
	startErr  error
	snapshots map[string]facebook.Snapshot
}

func (f *fakeFacebookOperations) Start(id, _, filename, _, _ string, _ []facebook.DownloadItem, _ map[string]string) error {
	f.started = true
	if f.snapshots == nil {
		f.snapshots = make(map[string]facebook.Snapshot)
	}
	f.snapshots[id] = facebook.Snapshot{ID: id, State: "completed", Filename: filename}
	return f.startErr
}

func (f *fakeFacebookOperations) Cancel(id string) bool {
	_, ok := f.snapshots[id]
	return ok
}

func (f *fakeFacebookOperations) Delete(id string) bool {
	delete(f.snapshots, id)
	return true
}

func (f *fakeFacebookOperations) SetVideoDecision(_, _, _ string) error {
	return nil
}

func (f *fakeFacebookOperations) ApplyVideoDecisions(_ string, _ map[string]string) error {
	return nil
}

func (f *fakeFacebookOperations) Snapshot(id string) (facebook.Snapshot, bool) {
	s, ok := f.snapshots[id]
	return s, ok
}

func (f *fakeFacebookOperations) Snapshots() []facebook.Snapshot {
	var list []facebook.Snapshot
	for _, s := range f.snapshots {
		list = append(list, s)
	}
	return list
}

func (f *fakeFacebookOperations) SetCanonicalID(_, _ string) bool {
	return true
}

func TestHandlerRoutesToFacebook(t *testing.T) {
	fb := &fakeFacebookOperations{}
	handler := NewHandler(nil, fb)
	handler.pollInterval = time.Millisecond

	var sent []Message
	handler.Handle(context.Background(), Message{
		Type:    TaskAssign,
		TaskID:  "fb-task-1",
		Action:  CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://www.facebook.com/share/r/1C583twmiP/","filename":"reel.mp4","source":"facebook"}`),
	}, collect(&sent))

	if !fb.started {
		t.Fatalf("expected facebookOperations.Start to be called")
	}
	if len(sent) < 3 || sent[0].Type != TaskAccepted || sent[len(sent)-1].Type != TaskCompleted {
		t.Fatalf("expected TaskAccepted and TaskCompleted, got %+v", sent)
	}
}

type fakeInstagramOperations struct {
	started   bool
	startErr  error
	snapshots map[string]instagram.Snapshot
}

func (f *fakeInstagramOperations) Start(id, _, filename, _, _ string, _ []instagram.DownloadItem, _ map[string]string) error {
	f.started = true
	if f.snapshots == nil {
		f.snapshots = make(map[string]instagram.Snapshot)
	}
	f.snapshots[id] = instagram.Snapshot{ID: id, State: "completed", Filename: filename}
	return f.startErr
}

func (f *fakeInstagramOperations) Cancel(id string) bool {
	_, ok := f.snapshots[id]
	return ok
}

func (f *fakeInstagramOperations) Delete(id string) bool {
	delete(f.snapshots, id)
	return true
}

func (f *fakeInstagramOperations) SetVideoDecision(_, _, _ string) error {
	return nil
}

func (f *fakeInstagramOperations) ApplyVideoDecisions(_ string, _ map[string]string) error {
	return nil
}

func (f *fakeInstagramOperations) Snapshot(id string) (instagram.Snapshot, bool) {
	s, ok := f.snapshots[id]
	return s, ok
}

func (f *fakeInstagramOperations) Snapshots() []instagram.Snapshot {
	var list []instagram.Snapshot
	for _, s := range f.snapshots {
		list = append(list, s)
	}
	return list
}

func (f *fakeInstagramOperations) SetCanonicalID(_, _ string) bool {
	return true
}

func TestHandlerRoutesToInstagram(t *testing.T) {
	ig := &fakeInstagramOperations{}
	handler := NewHandler(nil, ig)
	handler.pollInterval = time.Millisecond

	var sent []Message
	handler.Handle(context.Background(), Message{
		Type:    TaskAssign,
		TaskID:  "ig-task-1",
		Action:  CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://www.instagram.com/p/DBcd123/","filename":"post.jpg","source":"instagram"}`),
	}, collect(&sent))

	if !ig.started {
		t.Fatalf("expected instagramOperations.Start to be called")
	}
	if len(sent) < 3 || sent[0].Type != TaskAccepted || sent[len(sent)-1].Type != TaskCompleted {
		t.Fatalf("expected TaskAccepted and TaskCompleted, got %+v", sent)
	}
}
