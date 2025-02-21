const express = require('express');
const Team = require('../models/Team');
const Match = require('../models/Match');
const router = express.Router();

// Get all teams
router.get('/teams', async (req, res) => {
  console.log('GET /api/teams called');
  try {
    const teams = await Team.find();
    if (!teams || teams.length === 0) {
      console.warn('No teams found in database');
      return res.status(404).json({ error: 'No teams found' });
    }
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Schedule a match with manual toss decision, starting at 0-0
router.post('/matches', async (req, res) => {
  const { team1, team2, overs, tossWinner } = req.body;
  if (!tossWinner || (tossWinner !== team1 && tossWinner !== team2)) {
    return res.status(400).json({ error: 'Invalid toss winner. Must be one of the teams.' });
  }
  const currentBattingTeam = tossWinner === team1 ? 'team1' : 'team2';
  const match = new Match({
    team1,
    team2,
    overs,
    toss: tossWinner,
    currentBattingTeam,
    status: 'in-progress',
    score: {
      team1: { runs: 0, wickets: 0, overs: 0, players: [] },
      team2: { runs: 0, wickets: 0, overs: 0, players: [] },
    },
    ballByBall: [],
    currentPartnership: { runs: 0, balls: 0 },
    currentBatsmen: { striker: null, nonStriker: null },
    currentBowler: null,
    date: new Date(),
  });
  await match.save();
  res.json(match);
});

// Get match details
router.get('/matches/:id', async (req, res) => {
  console.log('GET /api/matches/:id called with id:', req.params.id);
  const match = await Match.findById(req.params.id).populate('team1 team2');
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

// Get all matches
router.get('/matches', async (req, res) => {
  console.log('GET /api/matches called');
  try {
    const matches = await Match.find().populate('team1 team2');
    res.json(matches);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update match toss and batting team
router.patch('/matches/:id', async (req, res) => {
  console.log('PATCH /api/matches/:id called with body:', req.body);
  try {
    const { toss, currentBattingTeam } = req.body;
    const match = await Match.findById(req.params.id).populate('team1 team2');

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const team1Name = match.team1.name;
    const team2Name = match.team2.name;
    if (!toss || (toss !== team1Name && toss !== team2Name)) {
      return res.status(400).json({ error: 'Invalid toss winner. Must be one of the teams.' });
    }
    if (!currentBattingTeam || (currentBattingTeam !== 'team1' && currentBattingTeam !== 'team2')) {
      return res.status(400).json({ error: 'Invalid batting team. Must be team1 or team2.' });
    }

    match.toss = toss;
    match.currentBattingTeam = currentBattingTeam;
    match.status = 'in-progress';

    await match.save();
    req.io.emit('scoreUpdate', match);
    res.json(match);
  } catch (err) {
    console.error('Error updating match:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Set or update players (bowler → striker → non-striker workflow)
router.post('/matches/:id/setPlayers', async (req, res) => {
  console.log('Set Players request:', req.body);
  try {
    const { striker, nonStriker, bowler } = req.body;

    const match = await Match.findById(req.params.id).populate('team1 team2');

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const battingTeam = match.currentBattingTeam === 'team1' ? match.team1.players : match.team2.players;
    const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2.players : match.team1.players;

    console.log('Batting Team Players:', battingTeam.map(p => p.name)); // Debug log
    console.log('Bowling Team Players:', bowlingTeam.map(p => p.name)); // Debug log

    let strikerPlayer, nonStrikerPlayer, bowlerPlayer;

    // Initial setup or bowler update (bowler must be set first)
    if (bowler) {
      if (!bowler.trim()) return res.status(400).json({ error: 'Bowler name cannot be empty' });
      bowlerPlayer = bowlingTeam.find(p => p.name.toLowerCase() === bowler.toLowerCase().trim());
      if (!bowlerPlayer) return res.status(400).json({ error: `Bowler '${bowler}' not found in ${bowlingTeam.map(p => p.name).join(', ')}` });
      match.currentBowler = {
        name: bowlerPlayer.name,
        overs: 0,
        runs: 0,
        wickets: 0,
      };
    } else if (!match.currentBowler) {
      return res.status(400).json({ error: 'Bowler must be specified before striker or non-striker' });
    }

    // Striker update (after bowler is set, initial or after wicket)
    if (striker) {
      if (!striker.trim()) return res.status(400).json({ error: 'Striker name cannot be empty' });
      if (!match.currentBowler) return res.status(400).json({ error: 'Bowler must be set before setting striker' });
      strikerPlayer = battingTeam.find(p => p.name.toLowerCase() === striker.toLowerCase().trim());
      if (!strikerPlayer) return res.status(400).json({ error: `Striker '${striker}' not found in ${battingTeam.map(p => p.name).join(', ')}` });
      match.currentBatsmen.striker = {
        name: strikerPlayer.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      };
    } else if (!match.currentBatsmen?.striker) {
      return res.status(400).json({ error: 'Striker must be specified before non-striker' });
    }

    // Non-striker update (after bowler and striker are set, initial only)
    if (nonStriker) {
      if (!nonStriker.trim()) return res.status(400).json({ error: 'Non-striker name cannot be empty' });
      if (!match.currentBowler || !match.currentBatsmen?.striker) {
        return res.status(400).json({ error: 'Bowler and striker must be set before setting non-striker' });
      }
      nonStrikerPlayer = battingTeam.find(p => p.name.toLowerCase() === nonStriker.toLowerCase().trim() && p.name.toLowerCase() !== match.currentBatsmen.striker.name.toLowerCase());
      if (!nonStrikerPlayer) return res.status(400).json({ error: `Non-striker '${nonStriker}' not found in ${battingTeam.map(p => p.name).join(', ')} or conflicts with striker` });
      match.currentBatsmen.nonStriker = {
        name: nonStrikerPlayer.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      };
    }

    // Ensure at least one field is provided
    if (!striker && !nonStriker && !bowler) {
      return res.status(400).json({ error: 'At least one player (bowler, striker, or non-striker) must be specified' });
    }

    await match.save();
    req.io.emit('scoreUpdate', match);
    res.json(match);
  } catch (err) {
    console.error('Error setting players:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update score with cricket logic, starting from 0-0, with over starting at 1.1
router.post('/matches/:id/update', async (req, res) => {
  console.log('POST /api/matches/:id/update called with body:', req.body);
  try {
    const { event, batsman, bowler, wicketType, runsOnWicket, additionalRuns } = req.body;
    const match = await Match.findById(req.params.id).populate('team1 team2');

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const ballCount = match.ballByBall.length;
    const currentOver = Math.floor(ballCount / 6) + 1; // Start over at 1 for first ball
    const currentBall = (ballCount % 6) + 1; // Start ball at 1 for first ball
    const overString = `${currentOver}.${currentBall}`; // Format as X.Y, e.g., 1.1 for first ball

    const battingTeamKey = match.currentBattingTeam === 'team1' ? 'team1' : 'team2';
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    if (!event || !event.trim()) {
      return res.status(400).json({ error: 'Event is required and cannot be empty' });
    }

    let ballEvent = {
      over: currentOver,
      ball: currentBall,
      overString,
      event: event.trim(),
      team: match.currentBattingTeam,
      batsman: batsman || match.currentBatsmen?.striker?.name || '',
      bowler: bowler || match.currentBowler?.name || '',
      wicketType: wicketType || null,
      runsOnWicket: runsOnWicket || 0,
      extraRuns: event === 'Wide' || event === 'No Ball' ? 1 + (additionalRuns || 0) : 0,
      additionalRuns: additionalRuns || 0,
    };

    if (!match.currentBatsmen.striker || !match.currentBowler) {
      return res.status(400).json({ error: 'Striker or bowler not set' });
    }

    const battingTeam = match.currentBattingTeam === 'team1' ? match.team1.players : match.team2.players;
    const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2.players : match.team1.players;

    const strikerPlayer = match.currentBatsmen.striker;
    const bowlerPlayer = match.currentBowler;

    if (!strikerPlayer.name || !bowlerPlayer.name) {
      return res.status(400).json({ error: `Striker or bowler not found in current match state` });
    }

    // Update match state based on event, starting from 0-0
    if (!isNaN(parseInt(event))) { // Runs (1, 2, 3, 4, 6)
      const runs = parseInt(event);
      match.score[battingTeamKey].runs += runs;
      match.score[battingTeamKey].overs += 1 / 6; // Increment by 0.1667 per ball
      match.currentPartnership.runs += runs;
      match.currentPartnership.balls += 1;

      strikerPlayer.runs += runs;
      strikerPlayer.balls += 1;
      if (runs === 4) strikerPlayer.fours += 1;
      if (runs === 6) strikerPlayer.sixes += 1;

      bowlerPlayer.overs += 1 / 6;
      bowlerPlayer.runs += runs;

      // Rotate strike based on runs (odd/even)
      if (runs % 2 === 1) { // Odd runs (1, 3) change strike
        [match.currentBatsmen.striker, match.currentBatsmen.nonStriker] = [
          match.currentBatsmen.nonStriker,
          match.currentBatsmen.striker,
        ];
      }
    } else if (event === 'Wide' || event === 'No Ball') { // Extras
      const totalRuns = 1 + (additionalRuns || 0);
      match.score[battingTeamKey].runs += totalRuns;
      match.score[battingTeamKey].overs += 0.1 / 6; // Increment minimally for extras
      bowlerPlayer.runs += totalRuns;
      ballEvent.extraRuns = totalRuns;
      if (additionalRuns) {
        strikerPlayer.runs += additionalRuns;
        if (additionalRuns % 2 === 1) {
          [match.currentBatsmen.striker, match.currentBatsmen.nonStriker] = [
            match.currentBatsmen.nonStriker,
            match.currentBatsmen.striker,
          ];
        }
      }
    } else if (event === 'Wicket') { // Wicket
      match.score[battingTeamKey].wickets += 1;
      match.score[battingTeamKey].overs += 1 / 6;
      match.currentPartnership.runs = 0;
      match.currentPartnership.balls = 0;

      strikerPlayer.out = true;
      strikerPlayer.balls += 1;

      bowlerPlayer.overs += 1 / 6;
      bowlerPlayer.wickets += 1;
      bowlerPlayer.runs += runsOnWicket || 0;

      ballEvent.wicketType = wicketType || 'Bowled';
      if (wicketType === 'Run Out') {
        match.score[battingTeamKey].runs += runsOnWicket || 0;
        strikerPlayer.runs += runsOnWicket || 0;
      }

      match.currentBatsmen.striker = null; // Prompt for new striker in frontend
      match.currentBowler = null; // Reset bowler after wicket, prompting for new bowler first
    }

    // Check over completion (6 balls)
    if (currentBall === 6) {
      match.currentBowler = null; // Reset bowler for next over
      // Rotate strike at the end of the over (switch striker and non-striker)
      if (match.currentBatsmen.striker && match.currentBatsmen.nonStriker) {
        [match.currentBatsmen.striker, match.currentBatsmen.nonStriker] = [
          match.currentBatsmen.nonStriker,
          match.currentBatsmen.striker,
        ];
      }
    }

    // Check match outcome (simplified for brevity, expand as needed)
    const totalOvers = match.overs * 6; // Total balls (e.g., 20 overs = 120 balls)
    if (match.score[battingTeamKey].overs >= totalOvers || match.score[battingTeamKey].wickets === battingTeam.length) {
      // End of innings or all out
      match.status = 'completed';
      await match.save();
      req.io.emit('scoreUpdate', { ...match.toJSON(), status: 'completed' });
      return res.json({ ...match.toJSON(), status: 'completed' });
    }

    match.ballByBall.push(ballEvent);
    await match.save();
    req.io.emit('scoreUpdate', match);
    res.json(match);
  } catch (err) {
    console.error('Error updating score:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Undo last ball
router.delete('/matches/:id/ball', async (req, res) => {
  console.log('DELETE /api/matches/:id/ball called with id:', req.params.id);
  try {
    const match = await Match.findById(req.params.id).populate('team1 team2');
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const lastBall = match.ballByBall.pop();

    if (!lastBall) return res.status(400).json({ error: 'No balls to undo' });

    const battingTeamKey = lastBall.team === 'team1' ? 'team1' : 'team2';
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    const battingTeam = match.currentBattingTeam === 'team1' ? match.team1.players : match.team2.players;
    const bowlingTeam = match.currentBattingTeam === 'team1' ? match.team2.players : match.team1.players;

    if (!isNaN(parseInt(lastBall.event))) {
      match.score[battingTeamKey].runs -= parseInt(lastBall.event);
      match.score[battingTeamKey].overs -= 1 / 6;
      match.currentPartnership.runs -= parseInt(lastBall.event);
      match.currentPartnership.balls -= 1;

      const striker = match.currentBatsmen.striker || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      striker.runs -= parseInt(lastBall.event);
      striker.balls -= 1;
      if (parseInt(lastBall.event) === 4) striker.fours -= 1;
      if (parseInt(lastBall.event) === 6) striker.sixes -= 1;

      const bowlerObj = bowlingTeam.find(p => p.name.toLowerCase() === lastBall.bowler.toLowerCase().trim()) || { overs: 0, runs: 0, wickets: 0 };
      bowlerObj.overs -= 1 / 6;
      bowlerObj.runs -= parseInt(lastBall.event);
    } else if (lastBall.event === 'Wide' || lastBall.event === 'No Ball') {
      const totalRuns = 1 + (lastBall.additionalRuns || 0);
      match.score[battingTeamKey].runs -= totalRuns;
      match.score[battingTeamKey].overs -= 0.1 / 6;
      const bowlerObj = bowlingTeam.find(p => p.name.toLowerCase() === lastBall.bowler.toLowerCase().trim()) || { runs: 0 };
      bowlerObj.runs -= totalRuns;
      if (lastBall.additionalRuns) {
        const striker = match.currentBatsmen.striker || { runs: 0 };
        striker.runs -= lastBall.additionalRuns;
      }
    } else if (lastBall.event === 'Wicket') {
      match.score[battingTeamKey].wickets -= 1;
      match.score[battingTeamKey].overs -= 1 / 6;
      match.currentPartnership.runs = 0;
      match.currentPartnership.balls = 0;

      const strikerOut = match.currentBatsmen.striker || { out: false, balls: 0 };
      strikerOut.out = false;
      strikerOut.balls -= 1;

      const bowlerObj = bowlingTeam.find(p => p.name.toLowerCase() === lastBall.bowler.toLowerCase().trim()) || { overs: 0, wickets: 0, runs: 0 };
      bowlerObj.overs -= 1 / 6;
      bowlerObj.wickets -= 1;
      bowlerObj.runs -= (lastBall.runsOnWicket || 0);

      match.currentBatsmen.striker = match.currentBatsmen.striker || null;
      match.currentBowler = match.currentBowler || null;
    }

    // Adjust over if needed after undo
    if (match.ballByBall.length % 6 === 0 && match.ballByBall.length > 0) {
      match.currentBowler = null; // Reset bowler if undoing last ball of over
      if (match.currentBatsmen.striker && match.currentBatsmen.nonStriker) {
        [match.currentBatsmen.striker, match.currentBatsmen.nonStriker] = [
          match.currentBatsmen.nonStriker,
          match.currentBatsmen.striker,
        ];
      }
    }

    await match.save();
    req.io.emit('scoreUpdate', match);
    res.json(match);
  } catch (err) {
    console.error('Error undoing last ball:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Reset match to initial state (0-0)
router.post('/matches/:id/reset', async (req, res) => {
  console.log('POST /api/matches/:id/reset called with id:', req.params.id);
  try {
    const match = await Match.findById(req.params.id).populate('team1 team2');

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const team1Name = match.team1.name;
    const team2Name = match.team2.name;
    const toss = match.toss; // Preserve toss and batting team
    const currentBattingTeam = match.currentBattingTeam;

    // Reset match to initial state (0-0)
    match.status = 'scheduled';
    match.score.team1.runs = 0;
    match.score.team1.wickets = 0;
    match.score.team1.overs = 0;
    match.score.team1.players = match.team1.players.map(p => ({
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
    }));
    match.score.team2.runs = 0;
    match.score.team2.wickets = 0;
    match.score.team2.overs = 0;
    match.score.team2.players = match.team2.players.map(p => ({
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
    }));
    match.ballByBall = [];
    match.currentPartnership.runs = 0;
    match.currentPartnership.balls = 0;
    match.currentBatsmen.striker = null;
    match.currentBatsmen.nonStriker = null;
    match.currentBowler = null;
    match.toss = toss;
    match.currentBattingTeam = currentBattingTeam;

    await match.save();
    req.io.emit('scoreUpdate', match);
    res.json(match);
  } catch (err) {
    console.error('Error resetting match:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Reset all matches in MongoDB to initial state
router.post('/matches/resetAll', async (req, res) => {
  console.log('POST /api/matches/resetAll called');
  try {
    const matches = await Match.find().populate('team1 team2');
    for (const match of matches) {
      match.status = 'scheduled';
      match.score.team1.runs = 0;
      match.score.team1.wickets = 0;
      match.score.team1.overs = 0;
      match.score.team1.players = match.team1.players.map(p => ({
        name: p.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      }));
      match.score.team2.runs = 0;
      match.score.team2.wickets = 0;
      match.score.team2.overs = 0;
      match.score.team2.players = match.team2.players.map(p => ({
        name: p.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      }));
      match.ballByBall = [];
      match.currentPartnership.runs = 0;
      match.currentPartnership.balls = 0;
      match.currentBatsmen.striker = null;
      match.currentBatsmen.nonStriker = null;
      match.currentBowler = null;
      await match.save();
    }
    req.io.emit('scoreUpdate', matches);
    res.json({ message: 'All matches reset successfully' });
  } catch (err) {
    console.error('Error resetting all matches:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;