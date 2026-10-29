import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ContentsView from '../components/layouts/MainLayout/Content/ContentView/ContentsView';
import Settings from '../components/layouts/MainLayout/Content/ContentView/Settings/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <ContentsView />,
      },
      {
        path: 'drives/:driveId',
        element: <ContentsView />,
      },
      {
        path: 'contents',
        element: <ContentsView />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);

export default router;
