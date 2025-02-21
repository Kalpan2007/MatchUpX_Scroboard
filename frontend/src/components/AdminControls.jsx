import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

function AdminControls({ match, matchId, onClose }) {
  const [event, setEvent] = useState('');
  const [wicketType, setWicketType] = useState('');
  const [runsOnWicket, setRunsOnWicket] = useState(0);
  const [additionalRuns, setAdditionalRuns] = useState(0); // For Wide/No Ball extras
  const [selectedBowler, setSelectedBowler] = useState('');
  const [selectedStriker, setSelectedStriker] = useState('');
  const [selectedNonStriker, setSelectedNonStriker] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('bowler'); // Workflow: 'bowler', 'striker', 'nonStriker', 'playing'
  const [needsNewBowler, setNeedsNewBowler] = useState(false);
  const [needsNewStriker, setNeedsNewStriker] = useState(false);

  const battingTeam = match.currentBattingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2 : match.team1;
  const eligibleBatsmen = battingTeam.players.filter(p => !p.out || !match.currentBatsmen?.striker || !match.currentBatsmen?.nonStriker || p.name !== match.currentBatsmen.striker?.name);
  const eligibleBowlers = bowlingTeam.players;

  useEffect(() => {
    // Check if a new bowler is needed (e.g., after an over, wicket, or initial setup)
    const currentBall = match.ballByBall.length % 6;
    setNeedsNewBowler(!match.currentBowler || (currentBall === 0 && match.ballByBall.length > 0) || !match.currentBatsmen?.striker);
    // Check if a new striker is needed (e.g., after a wicket or initial setup)
    setNeedsNewStriker(!match.currentBatsmen?.striker || (match.currentBatsmen?.striker?.out && eligibleBatsmen.length > 0));
    
    // Reset step based on current match state
    if (!match.currentBowler) {
      setStep('bowler');
    } else if (!match.currentBatsmen?.striker) {
      setStep('striker');
    } else if (!match.currentBatsmen?.nonStriker) {
      setStep('nonStriker');
    } else {
      setStep('playing');
    }
  }, [match, eligibleBatsmen]);

  const setBowler = async () => {
    if (!selectedBowler || !selectedBowler.trim()) {
      alert('Please select a valid bowler');
      return;
    }
    try {
      const response = await axios.post(
        `/api/matches/${matchId}/setPlayers`,
        { bowler: selectedBowler.trim() }
      );
      setSelectedBowler('');
      setNeedsNewBowler(false);
      setStep('striker'); // Move to striker selection after bowler is set
      setError('');
    } catch (err) {
      console.error('Error setting bowler:', err.response || err.message);
      setError('Failed to set bowler: ' + (err.response?.data?.error || err.message));
      alert('Error setting bowler: ' + (err.response?.data?.error || err.message));
    }
  };

  const setStriker = async () => {
    if (!selectedStriker || !selectedStriker.trim()) {
      alert('Please select a valid striker');
      return;
    }
    if (!match.currentBowler) {
      alert('Please select a bowler first');
      return;
    }
    try {
      const response = await axios.post(
        `/api/matches/${matchId}/setPlayers`,
        { striker: selectedStriker.trim() }
      );
      setSelectedStriker('');
      setNeedsNewStriker(false);
      setStep('nonStriker'); // Move to non-striker selection after striker is set
      setError('');
    } catch (err) {
      console.error('Error setting striker:', err.response || err.message);
      setError('Failed to set striker: ' + (err.response?.data?.error || err.message));
      alert('Error setting striker: ' + (err.response?.data?.error || err.message));
    }
  };

  const setNonStriker = async () => {
    if (!selectedNonStriker || !selectedNonStriker.trim()) {
      alert('Please select a valid non-striker');
      return;
    }
    if (!match.currentBowler || !match.currentBatsmen?.striker) {
      alert('Please select a bowler and striker first');
      return;
    }
    try {
      const response = await axios.post(
        `/api/matches/${matchId}/setPlayers`,
        { nonStriker: selectedNonStriker.trim() }
      );
      setSelectedNonStriker('');
      setStep('playing'); // Move to playing state after non-striker is set
      setError('');
    } catch (err) {
      console.error('Error setting non-striker:', err.response || err.message);
      setError('Failed to set non-striker: ' + (err.response?.data?.error || err.message));
      alert('Error setting non-striker: ' + (err.response?.data?.error || err.message));
    }
  };

  const updateScore = async () => {
    try {
      let eventData = { 
        event, 
        batsman: match.currentBatsmen?.striker?.name || '', 
        bowler: match.currentBowler?.name || '' 
      };
      if (event === 'Wicket') {
        eventData.wicketType = wicketType;
        eventData.runsOnWicket = runsOnWicket;
        if (!confirm(`Confirm ${wicketType} wicket for ${match.currentBatsmen?.striker?.name || 'striker'}?`)) return;
        setNeedsNewBowler(true); // Prioritize new bowler selection after wicket
        setNeedsNewStriker(true); // Trigger new striker selection after wicket
        setStep('bowler'); // Reset to bowler selection after wicket
      } else if (['Wide', 'No Ball'].includes(event)) {
        eventData.additionalRuns = additionalRuns;
        if (additionalRuns < 0 || additionalRuns > 6) {
          alert('Additional runs must be between 0 and 6');
          return;
        }
      } else if (!isNaN(parseInt(event))) { // Runs (1, 2, 3, 4, 6)
        const runs = parseInt(event);
        match.score[match.currentBattingTeam === 'team1' ? 'team1' : 'team2'].runs += runs;
        match.score[match.currentBattingTeam === 'team1' ? 'team1' : 'team2'].overs += 1 / 6;
        match.currentPartnership.runs += runs;
        match.currentPartnership.balls += 1;
        match.currentBatsmen.striker.runs += runs;
        match.currentBatsmen.striker.balls += 1;
        if (runs === 4) match.currentBatsmen.striker.fours += 1;
        if (runs === 6) match.currentBatsmen.striker.sixes += 1;

        const bowlerPlayer = match.currentBowler;
        bowlerPlayer.runs += runs;
        bowlerPlayer.overs += 1 / 6;

        // Rotate strike based on runs (odd/even)
        if (runs % 2 === 1) { // Odd runs (1, 3) change strike
          [match.currentBatsmen.striker, match.currentBatsmen.nonStriker] = [
            match.currentBatsmen.nonStriker,
            match.currentBatsmen.striker,
          ];
        }
      }
      const response = await axios.post(
        `/api/matches/${matchId}/update`,
        eventData
      );
      const updatedMatch = response.data;
      setEvent('');
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);

      // Check for over completion
      const currentBall = updatedMatch.ballByBall.length % 6;
      if (currentBall === 0 && updatedMatch.ballByBall.length > 0) {
        setNeedsNewBowler(true);
        setStep('bowler'); // Reset to bowler selection after over
        alert('Over completed. Please select a new bowler.');
      }
    } catch (err) {
      console.error('Update error:', err.response || err.message);
      setError('Failed to update: ' + (err.response?.data?.error || err.message));
      alert('Error updating score: ' + (err.response?.data?.error || err.message));
    }
  };

  const undoLastBall = async () => {
    try {
      const response = await axios.delete(`/api/matches/${matchId}/ball`);
      const updatedMatch = response.data;
      setEvent('');
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setNeedsNewStriker(!updatedMatch.currentBatsmen?.striker || (updatedMatch.currentBatsmen?.striker?.out && eligibleBatsmen.length > 0));
      setNeedsNewBowler(!updatedMatch.currentBowler || (updatedMatch.ballByBall.length % 6 === 0 && updatedMatch.ballByBall.length > 0));
      setStep(updatedMatch.currentBowler && updatedMatch.currentBatsmen?.striker && updatedMatch.currentBatsmen?.nonStriker ? 'playing' : 'bowler');
      setError('');
    } catch (err) {
      console.error('Undo error:', err.response || err.message);
      setError('Failed to undo: ' + (err.response?.data?.error || err.message));
      alert('Error undoing last ball: ' + (err.response?.data?.error || err.message));
    }
  };

  const resetMatch = async () => {
    try {
      if (!confirm('Reset the match to initial state? This will erase all progress.')) return;
      const response = await axios.post(`/api/matches/${matchId}/reset`);
      setSelectedBowler('');
      setSelectedStriker('');
      setSelectedNonStriker('');
      setNeedsNewBowler(false);
      setNeedsNewStriker(true);
      setStep('bowler');
      setEvent('');
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setError('');
    } catch (err) {
      console.error('Reset error:', err.response || err.message);
      setError('Failed to reset: ' + (err.response?.data?.error || err.message));
      alert('Error resetting match: ' + (err.response?.data?.error || err.message));
    }
  };

  const resetAllMatches = async () => {
    try {
      if (!confirm('Reset all matches to initial state? This will erase all progress for all matches.')) return;
      await axios.post('/api/matches/resetAll');
      alert('All matches reset successfully');
      setSelectedBowler('');
      setSelectedStriker('');
      setSelectedNonStriker('');
      setNeedsNewBowler(false);
      setNeedsNewStriker(true);
      setStep('bowler');
      setEvent('');
      setWicketType('');
      setRunsOnWicket(0);
      setAdditionalRuns(0);
      setError('');
    } catch (err) {
      console.error('Error resetting all matches:', err.response || err.message);
      setError('Failed to reset all matches: ' + (err.response?.data?.error || err.message));
      alert('Error resetting all matches: ' + (err.response?.data?.error || err.message));
    }
  };

  if (!match) return <div className="p-4">Loading match data...</div>;

  return (
    <div className="mt-4 p-4 bg-white rounded shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Admin Panel</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Step 1: Select Bowler (initial setup, after over, or after wicket) */}
      {(step === 'bowler' || needsNewBowler) && (
        <div className="flex flex-col gap-4 mb-4">
          <h3 className="text-lg font-semibold">Select Bowler</h3>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Bowler</InputLabel>
            <Select value={selectedBowler} onChange={(e) => setSelectedBowler(e.target.value)}>
              {eligibleBowlers.map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={setBowler}
            className="mt-2"
            sx={{ textTransform: 'none' }}
          >
            Set Bowler
          </Button>
        </div>
      )}

      {/* Step 2: Select Striker (after bowler is set, initial or after wicket) */}
      {step === 'striker' && (
        <div className="flex flex-col gap-4 mb-4">
          <h3 className="text-lg font-semibold">Select Striker</h3>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Striker</InputLabel>
            <Select value={selectedStriker} onChange={(e) => setSelectedStriker(e.target.value)}>
              {eligibleBatsmen.map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={setStriker}
            className="mt-2"
            sx={{ textTransform: 'none' }}
          >
            Set Striker
          </Button>
        </div>
      )}

      {/* Step 3: Select Non-Striker (after bowler and striker are set, initial only) */}
      {step === 'nonStriker' && (
        <div className="flex flex-col gap-4 mb-4">
          <h3 className="text-lg font-semibold">Select Non-Striker</h3>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Non-Striker</InputLabel>
            <Select value={selectedNonStriker} onChange={(e) => setSelectedNonStriker(e.target.value)}>
              {eligibleBatsmen.filter(p => p.name !== selectedStriker && p.name !== match.currentBatsmen?.striker?.name).map((player) => (
                <MenuItem key={player.name} value={player.name}>{player.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={setNonStriker}
            className="mt-2"
            sx={{ textTransform: 'none' }}
          >
            Set Non-Striker
          </Button>
        </div>
      )}

      {/* Playing State: Current Players and Score Updates */}
      {step === 'playing' && match.currentBowler && match.currentBatsmen?.striker && match.currentBatsmen?.nonStriker && !needsNewBowler && !needsNewStriker && (
        <div className="flex flex-col gap-4">
          <div className="mb-4">
            <p className="text-gray-700">Current Striker: {match.currentBatsmen.striker.name}</p>
            <p className="text-gray-700">Current Non-Striker: {match.currentBatsmen.nonStriker.name}</p>
            <p className="text-gray-700">Current Bowler: {match.currentBowler.name}</p>
            <p className="text-gray-700">Current Over: {match.ballByBall.length > 0 ? match.ballByBall[match.ballByBall.length - 1].overString : '0.0'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Event Buttons for Runs (No confirm, direct update with strike change) */}
            {[1, 2, 3, 4, 6].map((ev) => (
              <Button
                key={ev}
                variant="outlined"
                onClick={() => {
                  setEvent(ev.toString());
                  updateScore();
                }}
                className="mr-2 mb-2"
                sx={{ textTransform: 'none' }}
              >
                {ev} Run
              </Button>
            ))}
            {/* Event Buttons for Extras (Prompt for additional runs) */}
            {['Wide', 'No Ball'].map((ev) => (
              <Button
                key={ev}
                variant="outlined"
                onClick={() => {
                  setEvent(ev);
                  const runs = prompt(`Enter additional runs for ${ev} (0-6):`, '0');
                  const parsedRuns = parseInt(runs) || 0;
                  if (parsedRuns >= 0 && parsedRuns <= 6) {
                    setAdditionalRuns(parsedRuns);
                    updateScore();
                  } else {
                    alert('Invalid runs. Please enter a number between 0 and 6.');
                  }
                }}
                className="mr-2 mb-2"
                sx={{ textTransform: 'none' }}
              >
                {ev}
              </Button>
            ))}
            {/* Wicket Button with Confirm and Type Selection */}
            <Button
              variant="outlined"
              onClick={() => setEvent('Wicket')}
              className="mr-2 mb-2"
              sx={{ textTransform: 'none' }}
            >
              Wicket
            </Button>
            {event === 'Wicket' && (
              <div className="mt-2">
                <FormControl sx={{ minWidth: 120, mr: 2 }}>
                  <InputLabel>Wicket Type</InputLabel>
                  <Select value={wicketType} onChange={(e) => setWicketType(e.target.value)}>
                    <MenuItem value="Bowled">Bowled</MenuItem>
                    <MenuItem value="Caught">Caught</MenuItem>
                    <MenuItem value="Run Out">Run Out</MenuItem>
                    <MenuItem value="LBW">LBW</MenuItem>
                    <MenuItem value="Stumped">Stumped</MenuItem>
                  </Select>
                </FormControl>
                {wicketType === 'Run Out' && (
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Runs on Wicket</InputLabel>
                    <Select value={runsOnWicket} onChange={(e) => setRunsOnWicket(parseInt(e.target.value))}>
                      {[0, 1, 2, 3, 4, 6].map(r => (
                        <MenuItem key={r} value={r}>{r}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <Button
                  variant="contained"
                  onClick={updateScore}
                  className="mt-2"
                  sx={{ textTransform: 'none' }}
                >
                  Confirm Wicket
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outlined"
              onClick={undoLastBall}
              className="mt-2"
              sx={{ textTransform: 'none' }}
            >
              Undo Last Ball
            </Button>
            <Button
              variant="outlined"
              onClick={resetMatch}
              className="mt-2"
              sx={{ textTransform: 'none' }}
            >
              Reset This Match
            </Button>
            <Button
              variant="outlined"
              onClick={resetAllMatches}
              className="mt-2"
              sx={{ textTransform: 'none' }}
            >
              Reset All Matches
            </Button>
            <Button
              variant="outlined"
              onClick={onClose}
              className="mt-2"
              sx={{ textTransform: 'none' }}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminControls;