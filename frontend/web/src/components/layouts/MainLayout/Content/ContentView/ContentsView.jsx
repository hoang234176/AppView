import useLayout from '../../../../../hooks/useLayout';
import './ContentsView.css';

function ContentsView() {
  const { triggerNotification } = useLayout();

  const handleTestSuccess = () => {
    triggerNotification({
      type: 'success',
      title: 'Success',
      message: 'File downloaded successfully to your local storage.',
    });
  };

  const handleTestError = () => {
    triggerNotification({
      type: 'error',
      title: 'Download Failed',
      message: 'Cannot connect to Coordinator server at 127.0.0.1:8090. Please verify your network and check coordinator service status.',
    });
  };

  return (
    <div className="contents-view">
      <div className="contents-test-bar">
        <button
          type="button"
          className="contents-test-btn contents-test-btn--success"
          onClick={handleTestSuccess}
        >
          Test Success
        </button>
        <button
          type="button"
          className="contents-test-btn contents-test-btn--error"
          onClick={handleTestError}
        >
          Test Error
        </button>
      </div>

      {/* Thẻ xanh nhạt dài vượt cỡ để thử nghiệm cuộn */}
      <div className="content-scroll-tester" />
    </div>
  );
}

export default ContentsView;
