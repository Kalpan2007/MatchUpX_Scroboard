import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

function AdminControls({ match, matchId, setMatch, onClose }) {
  const [wicketType, setWicketType] = useState('');
  const [runsOnWicket, setRunsOnWicket] = useState(0);
  const [additionalRuns, setAdditionalRuns] = useState(0);
  const [selectedStriker, setSelectedStriker] = useState('');
  const [selectedBowler, setSelectedBowler] = useState('');
  const [selectedNonStriker, setSelectedNonStriker] = useState('');
  const [error, setError] = useState('');
  const [needsNewStriker, setNeedsNewStriker] = useState(false);
  const [needsNewBowler, setNeedsNewBowler] = useState(false);
  const [needsNewNonStriker, setNeedsNewNonStriker] = useState(false);

  const battingTeam = match.currentBattingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2 : match.team1;
  const eligibleBatsmen = battingTeam.players.filter(p => !p.out && p.name !== match.currentBatsmen?.striker?.name);
  const eligibleBowlers = bowlingTeam.players;

  useEffect(() => {
    setNeedsNewStriker(!match.currentBatsmen?.striker);
    setNeedsNewNonStriker(!match.currentBatsmen?.nonStriker && match.currentBatsmen?.striker);
    setNeedsNewBowler(!match.currentBowler || (match.ballByBall.length % 6 === 0 && match.ballByBall.length > 0));
  }, [match]);

  const setPlayers = async (players) => {
    try {
      const response = await axios.post(`/api/matches/${matchId}/setPlayers`, players);
      setMatch(response.data);
      setError('');
      if (players.striker) {
        setSelectedStriker('');
        setNeedsNewStriker(false);
      }
      if (players.nonStriker) {
        setSelectedNonStriker('');
        setNeedsNewNonStriker(false);
      }
      if (players.bowler) {
        setSelectedBowler('');
        setNeedsNewBowler(false);
      }
    } catch (err) {
      setError('Failed to set players: ' + (err.response?.data?.error || err.message));
    }
  };

  const updateScore = async (eventValue) => {
    if (!match.currentBatsmen?.striker || !match.currentBowler || !match.currentBatsmen?.nonStriker) {
      setError('All players must be set');
      return;
    }

    try {
      const eventData = {
        event: eventValue,
        batsman: match.currentBatsmen.striker.name,
        bowler: match.currentBowler.name,
      };
      if (eventValue === 'Wicket') {
        eventData.wicketType = wicketType;
        eventData.runsOnWicket = runsOnWicket;
        if (!confirm(`Confirm ${wicketType} wicket for ${match.currentBatsmen.striker.name}?`)) return;
      } else if (['Wide', 'No Ball'].includes(eventValue)) {
        eventData.additionalRuns = additionalRuns;
      }

      const response = await axios.post(`/api/matches/${matchId}/update`, eventData);
      setMatch(response.data);
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setError('');

      const balls = response.data.ballByBall.length;
      if (balls % 6 === 0 && balls > 0) {
        setNeedsNewBowler(true);
      }
      if (eventValue === 'Wicket') {
        setNeedsNewStriker(true);
      }
    } catch (err) {
      setError('Failed to update: ' + (err.response?.data?.error || err.message));
    }
  };

  const undoLastBall = async () => {
    try {
      const response = await axios.delete(`/api/matches/${matchId}/ball`);
      setMatch(response.data);
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setNeedsNewStriker(!response.data.currentBatsmen?.striker);
      setNeedsNewBowler(!response.data.currentBowler || (response.data.ballByBall.length % 6 === 0 && response.data.ballByBall.length > 0));
      setNeedsNewNonStriker(!response.data.currentBatsmen?.nonStriker && response.data.currentBatsmen?.striker);
      setError('');
    } catch (err) {
      setError('Failed to undo: ' + (err.response?.data?.error || err.message));
    }
  };

  const resetMatch = async () => {
    if (!confirm('Reset the match?')) return;
    try {
      const response = await axios.post(`/api/matches/${matchId}/reset`);
      setMatch(response.data);
      setNeedsNewStriker(true);
      setNeedsNewBowler(true);
      setNeedsNewNonStriker(true);
      setError('');
    } catch (err) {
      setError('Failed to reset: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="mt-6 p-6 bg-gray-800 rounded-lg shadow-xl border border-blue-600">
      <h2 className="text-2xl font-bold mb-4 text-blue-300">Admin Control Panel</h2>
      {error && <p className="text-red-400 mb-4 bg-red-900 p-2 rounded">{error}</p>}

      {needsNewStriker && (
        <div className="mb-4">
          <FormControl sx={{ minWidth: 150 }} className="bg-gray-700 text-white rounded">
            <InputLabel className="text-gray-300">Striker</InputLabel>
            <Select value={selectedStriker} onChange={(e) => setSelectedStriker(e.target.value)} className="text-white">
              {eligibleBatsmen.map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={() => setPlayers({ striker: selectedStriker })} variant="contained" className="bg-green-600 hover:bg-green-700 ml-4">
            Set Striker
          </Button>
        </div>
      )}

      {needsNewNonStriker && (
        <div className="mb-4">
          <FormControl sx={{ minWidth: 150 }} className="bg-gray-700 text-white rounded">
            <InputLabel className="text-gray-300">Non-Striker</InputLabel>
            <Select value={selectedNonStriker} onChange={(e) => setSelectedNonStriker(e.target.value)} className="text-white">
              {eligibleBatsmen.filter(p => p.name !== match.currentBatsmen?.striker?.name).map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={() => setPlayers({ nonStriker: selectedNonStriker })} variant="contained" className="bg-green-600 hover:bg-green-700 ml-4">
            Set Non-Striker
          </Button>
        </div>
      )}

      {needsNewBowler && (
        <div className="mb-4">
          <FormControl sx={{ minWidth: 150 }} className="bg-gray-700 text-white rounded">
            <InputLabel className="text-gray-300">Bowler</InputLabel>
            <Select value={selectedBowler} onChange={(e) => setSelectedBowler(e.target.value)} className="text-white">
              {eligibleBowlers.map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={() => setPlayers({ bowler: selectedBowler })} variant="contained" className="bg-green-600 hover:bg-green-700 ml-4">
            Set Bowler
          </Button>
        </div>
      )}

      {match.currentBatsmen?.striker && match.currentBowler && match.currentBatsmen?.nonStriker && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <p className="text-gray-300">Striker: <span className="text-green-400 font-semibold">{match.currentBatsmen.striker.name}</span></p>
            <p className="text-gray-300">Non-Striker: <span className="text-green-400 font-semibold">{match.currentBatsmen.nonStriker.name}</span></p>
            <p className="text-gray-300">Bowler: <span className="text-red-400 font-semibold">{match.currentBowler.name}</span></p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 6].map(run => (
              <Button
                key={run}
                variant="outlined"
                onClick={() => updateScore(run.toString())}
                className="bg-blue-600 text-white hover:bg-blue-700 border-none px-4 py-2 rounded-full"
              >
                {run} Run
              </Button>
            ))}
            {['Wide', 'No Ball'].map(extra => (
              <Button
                key={extra}
                variant="outlined"
                onClick={() => {
                  const runs = parseInt(prompt(`Additional runs for ${extra} (0-6):`) || '0');
                  if (runs >= 0 && runs <= 6) {
                    setAdditionalRuns(runs);
                    updateScore(extra);
                  } else {
                    setError('Invalid runs for ' + extra);
                  }
                }}
                className="bg-yellow-600 text-white hover:bg-yellow-700 border-none px-4 py-2 rounded-full"
              >
                {extra}
              </Button>
            ))}
            <Button
              variant="outlined"
              onClick={() => setWicketType('Bowled')} // Default to trigger wicket UI
              className="bg-red-600 text-white hover:bg-red-700 border-none px-4 py-2 rounded-full"
            >
              Wicket
            </Button>
          </div>
          {wicketType && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <FormControl sx={{ minWidth: 150, mr: 2 }} className="bg-gray-600 text-white rounded">
                <InputLabel className="text-gray-300">Wicket Type</InputLabel>
                <Select value={wicketType} onChange={(e) => setWicketType(e.target.value)} className="text-white">
                  <MenuItem value="Bowled">Bowled</MenuItem>
                  <MenuItem value="Caught">Caught</MenuItem>
                  <MenuItem value="Run Out">Run Out</MenuItem>
                  <MenuItem value="LBW">LBW</MenuItem>
                  <MenuItem value="Stumped">Stumped</MenuItem>
                </Select>
              </FormControl>
              {wicketType === 'Run Out' && (
                <FormControl sx={{ minWidth: 120 }} className="bg-gray-600 text-white rounded">
                  <InputLabel className="text-gray-300">Runs on Wicket</InputLabel>
                  <Select value={runsOnWicket} onChange={(e) => setRunsOnWicket(parseInt(e.target.value))} className="text-white">
                    {[0, 1, 2, 3, 4, 6].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <Button
                variant="contained"
                onClick={() => updateScore('Wicket')}
                className="bg-red-600 hover:bg-red-700 ml-4"
              >
                Confirm Wicket
              </Button>
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <Button variant="outlined" onClick={undoLastBall} className="bg-gray-600 text-white hover:bg-gray-700 border-none px-4 py-2 rounded-full">
              Undo Last Ball
            </Button>
            <Button variant="outlined" onClick={resetMatch} className="bg-gray-600 text-white hover:bg-gray-700 border-none px-4 py-2 rounded-full">
              Reset Match
            </Button>
            <Button variant="outlined" onClick={onClose} className="bg-gray-600 text-white hover:bg-gray-700 border-none px-4 py-2 rounded-full">
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminControls;