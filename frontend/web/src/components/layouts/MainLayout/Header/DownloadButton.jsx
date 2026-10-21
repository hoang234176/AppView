import './DownloadButton.css';
import DownloadIcon from '../../../../assets/icons/DownloadIcon';

function DownloadButton() {
  return (
    <button type="button" className="header-download-btn" aria-label="Tải xuống">
      <DownloadIcon />
    </button>
  );
}

export default DownloadButton;
