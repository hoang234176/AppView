# MediaFire archive package
from archive.mediafire.mediafire import (
    MediaFireResolver,
    extract_part_index,
    extract_archive_basename,
    resolve_single_archive,
    resolve_multipart_archive,
)

__all__ = [
    "MediaFireResolver",
    "extract_part_index",
    "extract_archive_basename",
    "resolve_single_archive",
    "resolve_multipart_archive",
    "ArchiveService",
    "archive_service",
    "GoArchiveClient",
    "go_archive_client",
    "GoArchiveJobMissingError",
    "GoStorageUnavailableError",
]

def __getattr__(name: str):
    if name in ("ArchiveService", "archive_service"):
        from archive.mediafire.service import ArchiveService, archive_service
        return ArchiveService if name == "ArchiveService" else archive_service
    if name in ("GoArchiveClient", "go_archive_client", "GoArchiveJobMissingError", "GoStorageUnavailableError"):
        import archive.mediafire.go_archive_client as gac
        return getattr(gac, name)
    raise AttributeError(f"module 'archive.mediafire' has no attribute '{name}'")
