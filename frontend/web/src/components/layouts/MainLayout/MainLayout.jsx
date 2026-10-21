import './MainLayout.css';
import Header from './Header/Header';
import Content from './Content/Content';

function MainLayout() {
  return (
    <div className="main-layout">
      <Header />
      <Content />
    </div>
  );
}

export default MainLayout;
