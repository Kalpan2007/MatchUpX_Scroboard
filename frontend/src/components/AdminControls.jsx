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
  const [selectedBattingTeam, setSelectedBattingTeam] = useState('');
  const [error, setError] = useState('');
  const [needsNewStriker, setNeedsNewStriker] = useState(false);
  const [needsNewBowler, setNeedsNewBowler] = useState(false);
  const [needsNewNonStriker, setNeedsNewNonStriker] = useState(false);
  const [isTeamDecided, setIsTeamDecided] = useState(!!match.currentBattingTeam);

  const battingTeam = match.currentBattingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2 : match.team1;
  const eligibleBatsmen = battingTeam?.players.filter(p => !p.out && p.name !== match.currentBatsmen?.striker?.name) || [];
  const eligibleBowlers = bowlingTeam?.players || [];

  useEffect(() => {
    if (match.currentBattingTeam) {
      setNeedsNewStriker(!match.currentBatsmen?.striker);
      setNeedsNewNonStriker(!match.currentBatsmen?.nonStriker && match.currentBatsmen?.striker);
      setNeedsNewBowler(!match.currentBowler || (match.ballByBall.filter(b => !['Wide', 'No Ball'].includes(b.event)).length % 6 === 0 && match.ballByBall.length > 0));
      setIsTeamDecided(true);
    } else {
      setIsTeamDecided(false);
    }
  }, [match]);

  const setBattingTeam = async () => {
    if (!selectedBattingTeam) {
      setError('Please select a batting team');
      return;
    }
    try {
      const response = await axios.patch(`/api/matches/${matchId}`, { currentBattingTeam: selectedBattingTeam });
      setMatch(response.data);
      setSelectedBattingTeam('');
      setIsTeamDecided(true);
      setError('');
    } catch (err) {
      setError('Failed to set batting team: ' + (err.response?.data?.error || err.message));
    }
  };

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

  const updateScore = async (eventValue, extraRuns = 0) => {
    if (!match.currentBattingTeam || !match.currentBatsmen?.striker || !match.currentBowler || !match.currentBatsmen?.nonStriker) {
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
        if (!wicketType) {
          setError('Please select a wicket type');
          return;
        }
        eventData.wicketType = wicketType;
        eventData.runsOnWicket = runsOnWicket;
        if (!confirm(`Confirm ${wicketType} wicket for ${match.currentBatsmen.striker.name}?`)) return;
      } else if (['Wide', 'No Ball'].includes(eventValue)) {
        eventData.additionalRuns = extraRuns;
      }

      const response = await axios.post(`/api/matches/${matchId}/update`, eventData);
      setMatch(response.data);
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setError('');

      const legalDeliveries = response.data.ballByBall.filter(b => !['Wide', 'No Ball'].includes(b.event)).length;
      if (legalDeliveries % 6 === 0 && legalDeliveries > 0) {
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
      setNeedsNewBowler(!response.data.currentBowler || (response.data.ballByBall.filter(b => !['Wide', 'No Ball'].includes(b.event)).length % 6 === 0 && response.data.ballByBall.length > 0));
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
      setIsTeamDecided(false);
      setError('');
    } catch (err) {
      setError('Failed to reset: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="mt-6 p-6 bg-[#1A2D46] rounded-lg shadow-xl border border-[#1A2D46]">
      <h2 className="text-2xl font-bold mb-4 text-white">Admin Control Panel</h2>
      {error && <p className="text-red-400 mb-4 bg-[#1A2D46] p-2 rounded">{error}</p>}

      {!isTeamDecided ? (
        <div className="mb-4">
          <p className="text-white mb-2">Select the batting team:</p>
          <FormControl sx={{ minWidth: 150 }} className="bg-[#1A2D46] text-white rounded">
            <InputLabel className="text-white">Batting Team</InputLabel>
            <Select value={selectedBattingTeam} onChange={(e) => setSelectedBattingTeam(e.target.value)} className="text-white">
              <MenuItem value="team1">{match.team1.name}</MenuItem>
              <MenuItem value="team2">{match.team2.name}</MenuItem>
            </Select>
          </FormControl>
          <Button
            onClick={setBattingTeam}
            variant="contained"
            className="bg-white hover:bg-gray-200 ml-4 text-white border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300"
          >
            Confirm Batting Team
          </Button>
        </div>
      ) : (
        <>
          {needsNewStriker && (
            <div className="mb-4">
              <FormControl sx={{ minWidth: 150 }} className="bg-[#1A2D46] text-white rounded">
                <InputLabel className="text-white">Striker</InputLabel>
                <Select value={selectedStriker} onChange={(e) => setSelectedStriker(e.target.value)} className="text-white">
                  {eligibleBatsmen.map((player) => (
                    <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={() => setPlayers({ striker: selectedStriker })} variant="contained" className="bg-white hover:bg-gray-200 ml-4 text-white border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                Set Striker
              </Button>
            </div>
          )}

          {needsNewNonStriker && (
            <div className="mb-4">
              <FormControl sx={{ minWidth: 150 }} className="bg-[#1A2D46] text-white rounded">
                <InputLabel className="text-white">Non-Striker</InputLabel>
                <Select value={selectedNonStriker} onChange={(e) => setSelectedNonStriker(e.target.value)} className="text-white">
                  {eligibleBatsmen.filter(p => p.name !== match.currentBatsmen?.striker?.name).map((player) => (
                    <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={() => setPlayers({ nonStriker: selectedNonStriker })} variant="contained" className="bg-white hover:bg-gray-200 ml-4 text-white border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                Set Non-Striker
              </Button>
            </div>
          )}

          {needsNewBowler && (
            <div className="mb-4">
              <FormControl sx={{ minWidth: 150 }} className="bg-[#1A2D46] text-white rounded">
                <InputLabel className="text-white">Bowler</InputLabel>
                <Select value={selectedBowler} onChange={(e) => setSelectedBowler(e.target.value)} className="text-white">
                  {eligibleBowlers.map((player) => (
                    <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={() => setPlayers({ bowler: selectedBowler })} variant="contained" className="bg-white hover:bg-gray-200 ml-4 text-white border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                Set Bowler
              </Button>
            </div>
          )}

          {match.currentBattingTeam && match.currentBatsmen?.striker && match.currentBowler && match.currentBatsmen?.nonStriker && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <p className="text-white">Striker: <span className="text-green-400 font-semibold">{match.currentBatsmen.striker.name}</span></p>
                <p className="text-white">Non-Striker: <span className="text-green-400 font-semibold">{match.currentBatsmen.nonStriker.name}</span></p>
                <p className="text-white">Bowler: <span className="text-red-400 font-semibold">{match.currentBowler.name}</span></p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 6].map(run => (
                  <Button
                    key={run}
                    variant="outlined"
                    onClick={() => updateScore(run.toString())}
                    className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300"
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
                        updateScore(extra, runs);
                      } else {
                        setError('Invalid runs for ' + extra);
                      }
                    }}
                    className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300"
                  >
                    {extra}
                  </Button>
                ))}
                <Button
                  variant="outlined"
                  onClick={() => setWicketType('Bowled')}
                  className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300"
                >
                  Wicket
                </Button>
              </div>
              {wicketType && (
                <div className="bg-[#1A2D46] p-4 rounded-lg">
                  <FormControl sx={{ minWidth: 150, mr: 2 }} className="bg-[#1A2D46] text-white rounded">
                    <InputLabel className="text-white">Wicket Type</InputLabel>
                    <Select value={wicketType} onChange={(e) => setWicketType(e.target.value)} className="text-white">
                      <MenuItem value="Bowled">Bowled</MenuItem>
                      <MenuItem value="Caught">Caught</MenuItem>
                      <MenuItem value="Run Out">Run Out</MenuItem>
                      <MenuItem value="LBW">LBW</MenuItem>
                      <MenuItem value="Stumped">Stumped</MenuItem>
                    </Select>
                  </FormControl>
                  {wicketType === 'Run Out' && (
                    <FormControl sx={{ minWidth: 120 }} className="bg-[#1A2D46] text-white rounded">
                      <InputLabel className="text-white">Runs on Wicket</InputLabel>
                      <Select value={runsOnWicket} onChange={(e) => setRunsOnWicket(parseInt(e.target.value))} className="text-white">
                        {[0, 1, 2, 3, 4, 6].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => updateScore('Wicket')}
                    className="bg-white hover:bg-gray-200 ml-4 text-white border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300"
                  >
                    Confirm Wicket
                  </Button>
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <Button variant="outlined" onClick={undoLastBall} className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                  Undo Last Ball
                </Button>
                <Button variant="outlined" onClick={resetMatch} className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                  Reset Match
                </Button>
                <Button variant="outlined" onClick={onClose} className="bg-white text-white hover:bg-gray-200 border border-blue-800 px-4 py-2 rounded-full shadow-[0_0_10px_rgba(0,112,255,0.7)] transition duration-300">
                  Close
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminControls;                               