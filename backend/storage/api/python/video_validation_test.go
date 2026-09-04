package pythonapi

import "testing"

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
