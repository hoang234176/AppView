package protocol

// Capability is a worker-advertised operation. Routing is capability-based,
// never based on worker language, host, or hard-coded worker IDs.
type Capability string

const (
	ResolveDownload Capability = "resolve_download"
	ScrapeMedia     Capability = "scrape_media"
	DownloadFile    Capability = "download_file"
	ProcessFile     Capability = "process_file"
	ConvertVideo    Capability = "convert_video"
	ExtractMedia    Capability = "extract_media"
)
