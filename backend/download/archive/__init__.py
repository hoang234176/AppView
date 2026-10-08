# Archive package

def __getattr__(name: str):
    if name in (
        "MediaFireResolver",
        "ArchiveService",
        "archive_service",
        "GoArchiveClient",
        "go_archive_client",
        "GoArchiveJobMissingError",
        "GoStorageUnavailableError",
        "extract_part_index",
        "extract_archive_basename",
        "resolve_single_archive",
        "resolve_multipart_archive",
    ):
        import archive.mediafire as m
        return getattr(m, name)
    if name in (
        "DownloadResolver",
        "ResolvedDownload",
        "format_photo_download_filename",
        "format_video_download_filename",
        "assign_unique_item_filenames",
    ):
        import contracts
        return getattr(contracts, name)
    raise AttributeError(f"module 'archive' has no attribute '{name}'")
