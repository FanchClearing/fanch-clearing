import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home.jsx';
import SportSelect from './screens/SportSelect.jsx';
import GameSelect from './screens/GameSelect.jsx';
import TeamSelect from './screens/TeamSelect.jsx';
import Room from './screens/Room.jsx';
import Host from './screens/Host.jsx';
import Preview from './screens/Preview.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sports" element={<SportSelect />} />
      <Route path="/games/:sport" element={<GameSelect />} />
      <Route path="/game/:gameId" element={<TeamSelect />} />
      <Route path="/room/:gameId" element={<Room />} />
      <Route path="/host/:gameId" element={<Host />} />
      {import.meta.env.DEV && (
        <Route path="/preview/cutscene/:teamId?" element={<Preview />} />
      )}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
