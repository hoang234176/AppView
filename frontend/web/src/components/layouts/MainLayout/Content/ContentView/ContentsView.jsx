import useLayout from '../../../../../hooks/useLayout';
import './ContentsView.css';

function ContentsView() {
  const { triggerNotification } = useLayout();

  return (
    <div className="contents-view">
      <div className="contents-test-bar">
        <button
          type="button"
          className="contents-test-btn"
          onClick={triggerNotification}
        >
          Test Notification (3s)
        </button>
      </div>

      {/* Thẻ xanh nhạt dài vượt cỡ để thử nghiệm cuộn */}
      <div className="content-scroll-tester" />
    </div>
  );
}

export default ContentsView;
