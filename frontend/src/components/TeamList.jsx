import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Button } from '@mui/material';

function TeamList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/teams')
      .then((res) => {
        console.log('Teams response:', res.data);
        const data = Array.isArray(res.data) ? res.data : [];
        setTeams(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching teams:', err);
        setError(err.response?.data?.error || 'Failed to fetch teams');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4 text-black">Loading teams...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (teams.length === 0) return <div className="p-4 text-black">No teams found.</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Teams</h1>
      <div className="grid grid-cols-2 gap-4 mt-4">
        {teams.map((team) => (
          <div key={team._id} className="p-4 bg-white rounded shadow">
            <h2 className="text-lg font-semibold">{team.name}</h2>
            <ul>
              {team.players.map((player, i) => (
                <li key={i}>
                  {player.name} - {player.runs}/{player.balls} ({player.fours}/{player.sixes})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button variant="contained" component={Link} to="/matches">
          Go to Schedule
        </Button>
      </div>
    </div>
  );
}

export default TeamList;