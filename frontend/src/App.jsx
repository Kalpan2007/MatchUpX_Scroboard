import { Routes, Route } from 'react-router-dom';
import Scoreboard from './components/Scoreboard';
import MatchSchedule from './components/MatchSchedule';
import TeamList from './components/TeamList';

function App() {
  return (
    <Routes>
      <Route path="/matches" element={<MatchSchedule />} />
      <Route path="/matches/:id" element={<Scoreboard />} />
      <Route path="/teams" element={<TeamList />} />
      <Route path="/" element={<MatchSchedule />} />
    </Routes>
  );
}

export default App;