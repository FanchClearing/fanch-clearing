import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home.jsx';
import SportSelect from './screens/SportSelect.jsx';
import GameSelect from './screens/GameSelect.jsx';
import TeamSelect from './screens/TeamSelect.jsx';
import Room from './screens/Room.jsx';
import Battle from './screens/Battle.jsx';
import Result from './screens/Result.jsx';
import Host from './screens/Host.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sports" element={<SportSelect />} />
      <Route path="/games/:sport" element={<GameSelect />} />
      <Route path="/game/:gameId" element={<TeamSelect />} />
      <Route path="/room/:gameId" element={<Room />} />
      <Route path="/battle/:gameId" element={<Battle />} />
      <Route path="/result/:gameId" element={<Result />} />
      <Route path="/host/:gameId" element={<Host />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
