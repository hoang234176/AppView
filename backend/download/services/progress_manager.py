from typing import List, Dict, Any
from models.download_task import DownloadTask, TaskStage

class ProgressManager:
    @staticmethod
    def calculate_summary(tasks: List[DownloadTask]) -> Dict[str, Any]:
        downloading_tasks = [t for t in tasks if t.stage in (TaskStage.QUEUED, TaskStage.RESOLVING, TaskStage.DOWNLOADING)]
        extracting_tasks = [t for t in tasks if t.stage in (TaskStage.WAITING_EXTRACT, TaskStage.EXTRACTING)]
        converting_tasks = [t for t in tasks if t.stage in (TaskStage.SCANNING, TaskStage.CONVERTING)]
        
        active_count = len(downloading_tasks) + len(extracting_tasks) + len(converting_tasks) + len([t for t in tasks if t.stage == TaskStage.PASSWORD_REQUIRED])
        
        # Calculate aggregate download percent (weighted by bytes)
        download_percent: float = 0.0
        known_total_bytes = sum(t.download_total_bytes for t in downloading_tasks if t.download_total_bytes and t.download_total_bytes > 0)
        known_downloaded_bytes = sum(t.downloaded_bytes for t in downloading_tasks if t.download_total_bytes and t.download_total_bytes > 0)
        
        if known_total_bytes > 0:
            download_percent = round((known_downloaded_bytes / known_total_bytes) * 100, 2)
        elif downloading_tasks:
            # Fallback to simple average if Content-Length unknown
            percents = [t.download_percent for t in downloading_tasks if t.download_percent is not None]
            download_percent = round(sum(percents) / len(percents), 2) if percents else 0.0

        # Calculate aggregate extraction percent
        extract_percent: float = 0.0
        if extracting_tasks:
            ext_percents = [t.extracted_percent for t in extracting_tasks if t.extracted_percent is not None]
            extract_percent = round(sum(ext_percents) / len(extracting_tasks) if ext_percents else 0.0, 2) if extracting_tasks else 0.0

        return {
            "active_count": active_count,
            "downloading_count": len(downloading_tasks),
            "extracting_count": len(extracting_tasks),
            "download": {
                "count": len(downloading_tasks),
                "percent": download_percent
            },
            "extract": {
                "count": len(extracting_tasks),
                "percent": extract_percent
            }
        }
