import Home from '@/pages/home';
import { createBrowserRouter } from 'react-router-dom';


export const router = createBrowserRouter([
    {
        path: '/',
        element: <Home />
    },
    {
        path: '/home',
        element: <Home />
    }
])
