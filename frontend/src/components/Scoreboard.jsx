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
    const fetchMatch = async () => {
      try {
        const res = await axios.get(`/api/matches/${matchId}`);
        setMatch(res.data);
      } catch (err) {
        console.error('Error fetching match:', err);
      }
    };
    fetchMatch();

    socket.on('scoreUpdate', (data) => {
      if (data._id === matchId) {
        setMatch(data);
        console.log('Match updated via socket:', data);
      }
    });

    return () => socket.off('scoreUpdate');
  }, [matchId]);

  if (!match) return <div className="p-4 text-white">Loading...</div>;

  const battingTeam = match.currentBattingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2 : match.team1;
  const striker = match.currentBatsmen?.striker || { name: 'Not set', runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStriker = match.currentBatsmen?.nonStriker || { name: 'Not set', runs: 0, balls: 0, fours: 0, sixes: 0 };
  const bowler = match.currentBowler || { name: 'Not set', overs: 0, runs: 0, wickets: 0 };

  const formatOvers = (overs) => {
    const totalBalls = Math.round(overs * 6);
    const over = Math.floor(totalBalls / 6);
    const ballInOver = totalBalls % 6;
    return `${over}.${ballInOver}`;
  };

  if (!match.currentBattingTeam) {
    return (
      <div className="p-6 bg-gradient-to-r from-blue-900 to-gray-900 min-h-screen text-white">
        <h1 className="text-4xl font-extrabold mb-4 text-center text-yellow-400 shadow-text">{match.team1.name} vs {match.team2.name}</h1>
        <p className="text-lg text-center text-gray-300 mb-6">Please decide the batting team in the admin panel.</p>
        <button
          onClick={() => setShowPasswordPrompt(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-semibold transition duration-300 mx-auto block"
        >
          Open Admin Panel
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
            setMatch={setMatch}
            onClose={() => setShowAdminPanel(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-r from-blue-900 to-gray-900 min-h-screen text-white">
      <h1 className="text-4xl font-extrabold mb-4 text-center text-yellow-400 shadow-text">{match.team1.name} vs {match.team2.name}</h1>
      <p className="mb-6 text-lg text-center text-gray-300">Toss: {match.toss} | Batting: <span className="text-green-400">{battingTeam.name}</span></p>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-800 p-5 rounded-lg shadow-lg border border-blue-500">
          <p className="font-semibold text-xl text-blue-300">{match.team1.name}:</p>
          <p className="text-3xl font-bold">{match.score.team1.runs}/{match.score.team1.wickets} <span className="text-sm">({formatOvers(match.score.team1.overs)} overs)</span></p>
          {match.score.team1.players.filter(p => p.runs > 0 || p.balls > 0).map(player => (
            <p key={player.name} className="text-sm text-gray-300 mt-1">
              {player.name}: {player.runs}/{player.balls} ({player.fours}/{player.sixes})
            </p>
          ))}
        </div>
        <div className="bg-gray-800 p-5 rounded-lg shadow-lg border border-blue-500">
          <p className="font-semibold text-xl text-blue-300">{match.team2.name}:</p>
          <p className="text-3xl font-bold">{match.score.team2.runs}/{match.score.team2.wickets} <span className="text-sm">({formatOvers(match.score.team2.overs)} overs)</span></p>
          {match.score.team2.players.filter(p => p.runs > 0 || p.balls > 0).map(player => (
            <p key={player.name} className="text-sm text-gray-300 mt-1">
              {player.name}: {player.runs}/{player.balls} ({player.fours}/{player.sixes})
            </p>
          ))}
        </div>
      </div>
      <div className="mb-8 bg-gray-800 p-5 rounded-lg shadow-lg">
        <p className="text-gray-300">Partnership: <span className="text-yellow-400">{match.currentPartnership.runs} runs ({match.currentPartnership.balls} balls)</span></p>
        <p className="text-gray-300">Striker: <span className="text-green-400">{striker.name}</span> - {striker.runs}/{striker.balls} ({striker.fours}/{striker.sixes})</p>
        <p className="text-gray-300">Non-Striker: <span className="text-green-400">{nonStriker.name}</span> - {nonStriker.runs}/{nonStriker.balls} ({nonStriker.fours}/{nonStriker.sixes})</p>
        <p className="text-gray-300">
          Bowler: <span className="text-red-400">{bowler.name}</span> - {(typeof bowler.overs === 'number' ? bowler.overs : 0).toFixed(1)} overs, {bowler.runs || 0} runs, {bowler.wickets || 0} wickets
        </p>
        <p className="text-gray-300">Current Over: <span className="text-blue-400">{formatOvers(match.score[match.currentBattingTeam].overs)}</span></p>
        <div id="ballHistory" className="flex gap-2 mt-2 flex-wrap">
          {match.ballByBall.slice(-10).map((ball, index) => (
            <span key={index} className="bg-blue-600 text-white px-2 py-1 rounded-full text-sm">{ball.event}{ball.extraRuns > 0 ? `+${ball.extraRuns}` : ''}</span>
          ))}
        </div>
      </div>
      <button
        onClick={() => setShowPasswordPrompt(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-semibold transition duration-300"
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
          setMatch={setMatch}
          onClose={() => setShowAdminPanel(false)}
        />
      )}
      <footer
        id="footer"
        className="mt-8 text-center text-gray-400 cursor-pointer"
        onClick={() => window.open('https://github.com/mochatek', '_blank')}
      >
        © 2025 Cricket Scoreboard | <span className="text-blue-400 underline hover:text-blue-300">Link to GitHub</span>
      </footer>
    </div>
  );
}

export default Scoreboard;