import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

function MatchSchedule() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTossDialog, setOpenTossDialog] = useState(null); // Match ID for toss decision
  const [selectedBattingTeam, setSelectedBattingTeam] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/matches')
      .then((res) => {
        console.log('Matches response:', res.data);
        setMatches(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching matches:', err);
        setLoading(false);
      });
  }, []);

  const createFixedSchedule = async () => {
    const teams = await axios.get('/api/teams').then(res => res.data);
    if (teams.length !== 4) return alert('Expected 4 teams');
  
    const schedule = [];
    const teamIds = teams.map(t => t._id);
    const startDate = new Date('2025-02-25T14:00:00Z');
  
    const pairings = [
      [teamIds[0], teamIds[1]],
      [teamIds[2], teamIds[3]],
      [teamIds[0], teamIds[2]],
      [teamIds[1], teamIds[3]],
      [teamIds[0], teamIds[3]],
      [teamIds[1], teamIds[2]]
    ];
  
    pairings.forEach((pair, index) => {
      const matchDate = new Date(startDate);
      matchDate.setDate(startDate.getDate() + index);
      // Admin decides batting team (example: alternate for simplicity, or add UI for choice)
      const battingTeam = index % 2 === 0 ? 'team1' : 'team2';
      schedule.push({
        team1: pair[0],
        team2: pair[1],
        overs: 20,
        battingTeam, // New field
        status: 'in-progress',
        score: { team1: { runs: 0, wickets: 0, overs: 0, players: [] }, team2: { runs: 0, wickets: 0, overs: 0, players: [] } },
        ballByBall: [],
        currentPartnership: { runs: 0, balls: 0 },
        currentBatsmen: { striker: null, nonStriker: null },
        currentBowler: null,
        date: matchDate,
      });
    });
  
    await Promise.all(schedule.map(match => axios.post('/api/matches', match)));
    setMatches(await axios.get('/api/matches').then(res => res.data));
  };

  const handleTossDecision = async () => {
    if (!selectedBattingTeam) return alert('Please select a batting team');
    const match = matches.find(m => m._id === openTossDialog);
    if (!match) return alert('Match not found');

    await axios.patch(`/api/matches/${openTossDialog}`, {
      toss: selectedBattingTeam,
      currentBattingTeam: match.team1.name === selectedBattingTeam ? 'team1' : 'team2',
      status: 'in-progress',
    });

    setMatches(await axios.get('/api/matches').then(res => res.data));
    setOpenTossDialog(null);
    setSelectedBattingTeam('');
    navigate(`/matches/${openTossDialog}`);
  };

  if (loading) return <div className="p-4">Loading matches...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Match Schedule</h1>
      <div className="mt-4">
        {matches.length === 0 ? (
          <p>No matches scheduled yet.</p>
        ) : (
          matches.map((match) => (
            <div key={match._id} className="mb-2">
              <Link
                to={match.currentBattingTeam ? `/matches/${match._id}` : '#'}
                className={`block p-4 bg-white rounded shadow ${match.currentBattingTeam ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                {match.team1?.name ?? 'Unknown'} vs {match.team2?.name ?? 'Unknown'}
                <span className="ml-2 text-sm text-gray-500">
                  {match.toss ? `(Toss: ${match.toss}, Batting: ${match.currentBattingTeam === 'team1' ? match.team1.name : match.team2.name})` : '(Toss pending)'}
                </span>
              </Link>
              {!match.currentBattingTeam && (
                <Button
                  variant="contained"
                  onClick={() => setOpenTossDialog(match._id)}
                  className="mt-2"
                  sx={{ textTransform: 'none' }}
                >
                  Set Toss & Batting Team
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="mt-4">
        <Button
          variant="contained"
          onClick={createFixedSchedule}
          disabled={matches.length > 0}
        >
          Create Fixed Schedule
        </Button>
      </div>

      <Dialog open={!!openTossDialog} onClose={() => setOpenTossDialog(null)}>
        <DialogTitle>Set Toss & Batting Team</DialogTitle>
        <DialogContent>
          <FormControl sx={{ minWidth: 200, mt: 2 }}>
            <InputLabel>Batting Team</InputLabel>
            <Select value={selectedBattingTeam} onChange={(e) => setSelectedBattingTeam(e.target.value)}>
              {matches.find(m => m._id === openTossDialog) && [
                matches.find(m => m._id === openTossDialog).team1.name,
                matches.find(m => m._id === openTossDialog).team2.name,
              ].map(teamName => (
                <MenuItem key={teamName} value={teamName}>{teamName}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTossDecision} variant="contained" sx={{ textTransform: 'none' }}>
            Confirm
          </Button>
          <Button onClick={() => setOpenTossDialog(null)} variant="outlined" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default MatchSchedule;