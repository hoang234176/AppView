import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from archive.mediafire import (
    MediaFireResolver,
    extract_part_index,
    extract_archive_basename,
    resolve_single_archive,
    resolve_multipart_archive,
)


def test_extract_part_index():
    assert extract_part_index("album.part1.rar") == 1
    assert extract_part_index("album.part02.rar") == 2
    assert extract_part_index("archive.7z.003") == 3
    assert extract_part_index("backup.z04") == 4
    assert extract_part_index("normal.rar") == 1


def test_extract_archive_basename():
    assert extract_archive_basename("Cosplay_Album.part1.rar") == "Cosplay_Album"
    assert extract_archive_basename("Cosplay_Album.part2.rar") == "Cosplay_Album"
    assert extract_archive_basename("Single_Archive.zip") == "Single_Archive"
    assert extract_archive_basename("Archive.7z.001") == "Archive"


@pytest.mark.anyio
async def test_resolve_single_archive():
    html_content = """
    <html>
        <body>
            <div class="filename">My_Archive.rar</div>
            <a id="downloadButton" href="https://download123.mediafire.com/xyz/My_Archive.rar">Download</a>
        </body>
    </html>
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = html_content

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp

    res = await resolve_single_archive("https://www.mediafire.com/file/abc123/My_Archive.rar", mock_client)
    assert res.filename == "My_Archive.rar"
    assert res.download_url == "https://download123.mediafire.com/xyz/My_Archive.rar"
    assert res.archive_type == "single"
    assert res.extension == "rar"


@pytest.mark.anyio
async def test_resolve_multipart_archive():
    folder_json = {
        "response": {
            "result": "Success",
            "folder_content": {
                "files": [
                    {
                        "quickkey": "k2",
                        "filename": "Album.part2.rar",
                        "size": "2000",
                        "links": {"normal_download": "https://www.mediafire.com/file/k2"},
                    },
                    {
                        "quickkey": "k1",
                        "filename": "Album.part1.rar",
                        "size": "1000",
                        "links": {"normal_download": "https://www.mediafire.com/file/k1"},
                    },
                ]
            },
        }
    }

    mock_api_resp = MagicMock()
    mock_api_resp.status_code = 200
    mock_api_resp.json.return_value = folder_json

    part1_html = '<a id="downloadButton" href="https://download.mediafire.com/part1.rar"></a><div class="filename">Album.part1.rar</div>'
    part2_html = '<a id="downloadButton" href="https://download.mediafire.com/part2.rar"></a><div class="filename">Album.part2.rar</div>'

    mock_part1_resp = MagicMock(status_code=200, text=part1_html)
    mock_part2_resp = MagicMock(status_code=200, text=part2_html)

    mock_client = AsyncMock()

    async def mock_get(url, *args, **kwargs):
        if "api/1.5/folder" in url:
            return mock_api_resp
        if "k1" in url:
            return mock_part1_resp
        if "k2" in url:
            return mock_part2_resp
        return MagicMock(status_code=404)

    mock_client.get.side_effect = mock_get

    res = await resolve_multipart_archive("https://www.mediafire.com/folder/xnfsq0ebto56w", mock_client)
    assert res.archive_type == "multipart"
    assert res.filename == "Album"
    assert len(res.items) == 2
    # Verify natural ordering: part 1 must come before part 2
    assert res.items[0]["filename"] == "Album.part1.rar"
    assert res.items[0]["part_index"] == 1
    assert res.items[1]["filename"] == "Album.part2.rar"
    assert res.items[1]["part_index"] == 2
    assert res.download_url == "https://download.mediafire.com/part1.rar"
