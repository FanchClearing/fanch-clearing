import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home.jsx';
import SportSelect from './screens/SportSelect.jsx';
import GameSelect from './screens/GameSelect.jsx';
import TeamSelect from './screens/TeamSelect.jsx';
import Room from './screens/Room.jsx';
import Host from './screens/Host.jsx';
import Admin from './screens/Admin.jsx';
import Preview, { PreviewBanner, PreviewBattle, PreviewCheer, PreviewTaunt } from './screens/Preview.jsx';
import ToastHost from './pixel/Toast.jsx';
import UpdateGuard from './pixel/UpdateGuard.jsx';

export default function App() {
  return (
    <>
      <ToastHost />
      <UpdateGuard />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sports" element={<SportSelect />} />
      <Route path="/games/:sport" element={<GameSelect />} />
      <Route path="/game/:gameId" element={<TeamSelect />} />
      <Route path="/room/:gameId" element={<Room />} />
      <Route path="/host/:gameId" element={<Host />} />
      <Route path="/admin/:gameId" element={<Admin />} />
      {import.meta.env.DEV && (
        <>
          <Route path="/preview/cutscene/:teamId?" element={<Preview />} />
          <Route path="/preview/battle" element={<PreviewBattle />} />
          <Route path="/preview/cheer" element={<PreviewCheer />} />
          <Route path="/preview/taunt" element={<PreviewTaunt />} />
          <Route path="/preview/banner" element={<PreviewBanner />} />
        </>
      )}
      <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
