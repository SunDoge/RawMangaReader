import classNames from "classnames";
import { RouterProvider } from 'react-router-dom';
import { router } from "./router";
import style from './style.module.less';

function App() {
  return (
    <div className={classNames(style.app, 'app')}>
      <RouterProvider router={router} />
    </div>
  );
}




export default App;
