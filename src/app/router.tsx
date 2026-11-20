import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './layout/AppShell';
import { paths } from './paths';
import { GroupRoute } from './routes/GroupRoute';
import { MeRoute } from './routes/MeRoute';
import { TodayRoute } from './routes/TodayRoute';
import { TrainingRoute } from './routes/TrainingRoute';

// BASE_URL is "/fitness-challenge/" on GitHub Pages and "/" locally.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to={paths.today} replace /> },
        { path: paths.today, element: <TodayRoute /> },
        { path: paths.training, element: <TrainingRoute /> },
        { path: paths.group, element: <GroupRoute /> },
        { path: paths.me, element: <MeRoute /> },
        { path: '*', element: <Navigate to={paths.today} replace /> },
      ],
    },
  ],
  { basename },
);
