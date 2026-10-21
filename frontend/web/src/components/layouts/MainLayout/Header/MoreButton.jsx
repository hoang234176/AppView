import './MoreButton.css';
import MoreIcon from '../../../../assets/icons/MoreIcon';

function MoreButton() {
  return (
    <button type="button" className="header-more-btn" aria-label="Tùy chọn khác">
      <MoreIcon />
    </button>
  );
}

export default MoreButton;
