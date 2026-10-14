package pythonapi

import (
	"os/exec"
	"path/filepath"
	"testing"
)

func TestResolutionClassUsesDimensionsWithoutUpscale(t *testing.T) {
	tests := []struct {
		width, height int
		want          string
	}{
		{3840, 2160, "4k"},
		{2160, 3840, "4k"},
		{2560, 1440, "2k"},
		{1920, 1080, "1080p_or_lower"},
	}
	for _, test := range tests {
		if got := resolutionClass(test.width, test.height); got != test.want {
			t.Errorf("resolutionClass(%d, %d) = %q, want %q", test.width, test.height, got, test.want)
		}
	}
}

func TestValidationRetainsIndependentCompatibilityDimensions(t *testing.T) {
	validation := (VideoCompatibility{IsVideo: true, ContainerOK: false, VideoOK: true, AudioOK: false, Width: 2560, Height: 1440}).Validation("nested/video.mkv")
	if validation.ContainerOK || !validation.VideoOK || validation.AudioOK || validation.ResolutionClass != "2k" {
		t.Fatalf("validation lost independent fields: %#v", validation)
	}
}

func TestMOVFilesTreatedAsCompatibleWithoutConversion(t *testing.T) {
	tempDir := t.TempDir()
	movPath := filepath.Join(tempDir, "test.mov")

	// Generate a short MOV with PCM audio (typical iPhone QuickTime recording)
	cmd := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=0.2",
		"-f", "lavfi", "-i", "sine=f=1000:d=0.2", "-c:v", "libx264", "-c:a", "pcm_s16le", movPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("skipping test as ffmpeg is not available: %v (%s)", err, string(out))
	}

	compat := probeVideoCompatibility(movPath)
	if !compat.IsCompatible() {
		t.Fatalf("MOV file with PCM audio must be treated as compatible for iPhone, got: %#v", compat)
	}
}
