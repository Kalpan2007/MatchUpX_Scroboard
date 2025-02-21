import { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import AdminControls from './AdminControls';
import PasswordPrompt from './PasswordPrompt';

const socket = io('http://localhost:5000');

function Scoreboard() {
  const [match, setMatch] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const matchId = window.location.pathname.split('/')[2];

  useEffect(() => {
    axios.get(`/api/matches/${matchId}`).then((res) => setMatch(res.data));
    socket.on('scoreUpdate', (data) => {
      if (data._id === matchId) {
        setMatch(data);
        console.log('Match updated:', data);
      }
    });
    return () => socket.off('scoreUpdate');
  }, [matchId]);

  if (!match) return <div className="p-4">Loading...</div>;

  const battingTeam = match.currentBattingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2 : match.team1;
  const striker = match.currentBatsmen?.striker || { name: 'Not set', runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
  const nonStriker = match.currentBatsmen?.nonStriker || { name: 'Not set', runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
  const bowler = match.currentBowler || { name: 'Not set', overs: 0, runs: 0, wickets: 0 };

  // Use overs from match.score for both teams
  const team1Over = match.score.team1.overs.toFixed(1);
  const team2Over = match.score.team2.overs.toFixed(1);
  const currentOverString = match.ballByBall.length > 0 ? match.ballByBall[match.ballByBall.length - 1].overString : '0.0';

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">{match.team1.name} vs {match.team2.name}</h1>
      <p className="mb-4 text-gray-600">Toss: {match.toss} | Batting: {battingTeam.name}</p>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="font-semibold text-gray-700">{match.team1.name}:</p>
          <p className="text-lg">{match.score.team1.runs}/{match.score.team1.wickets} ({team1Over} overs)</p>
          {match.score.team1.players.filter(p => p.runs > 0 || p.balls > 0).map(player => (
            <p key={player.name} className="text-sm text-gray-600">
              {player.name}: {player.runs}/{player.balls} ({player.fours}/{player.sixes})
            </p>
          ))}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="font-semibold text-gray-700">{match.team2.name}:</p>
          <p className="text-lg">{match.score.team2.runs}/{match.score.team2.wickets} ({team2Over} overs)</p>
          {match.score.team2.players.filter(p => p.runs > 0 || p.balls > 0).map(player => (
            <p key={player.name} className="text-sm text-gray-600">
              {player.name}: {player.runs}/{player.balls} ({player.fours}/{player.sixes})
            </p>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <p className="text-gray-700">Partnership: {match.currentPartnership.runs} runs ({match.currentPartnership.balls} balls)</p>
        <p className="text-gray-700">Striker: {striker.name} - {striker.runs}/{striker.balls} ({striker.fours}/{striker.sixes})</p>
        <p className="text-gray-700">Non-Striker: {nonStriker.name}</p>
        <p className="text-gray-700">Bowler: {bowler.name} - {(bowler.overs || 0).toFixed(1)} overs, {bowler.runs || 0} runs, {bowler.wickets || 0} wickets</p>
      </div>
      <button
        onClick={() => setShowPasswordPrompt(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Update Score
      </button>
      {showPasswordPrompt && (
        <PasswordPrompt
          onSuccess={() => {
            setShowPasswordPrompt(false);
            setShowAdminPanel(true);
          }}
          onClose={() => setShowPasswordPrompt(false)}
        />
      )}
      {showAdminPanel && (
        <AdminControls
          match={match}
          matchId={matchId}
          onClose={() => setShowAdminPanel(false)}
        />
      )}
      <footer id="footer" className="mt-8 text-center text-gray-500 cursor-pointer" onClick={() => window.open('https://github.com/mochatek', '_blank')}>
        © 2025 Cricket Scoreboard | <span className="text-blue-500 underline">Link to GitHub</span>
      </footer>
    </div>
  );
}

export default Scoreboard;