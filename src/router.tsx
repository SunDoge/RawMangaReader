import Home from '@/pages/home';
import { createBrowserRouter } from 'react-router-dom';
import { ClipboardPage } from './pages/clipboard';


export const router = createBrowserRouter([
    {
        path: '/',
        element: <Home />
    },
    {
        path: '/home',
        element: <Home />
    },
    {
        path: '/clipboard',
        element: <ClipboardPage />
    }
])

