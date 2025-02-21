const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  out: { type: Boolean, default: false },
});

const scoreSchema = new mongoose.Schema({
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  overs: { type: Number, default: 0 },
  players: [playerStatsSchema],
});

const ballEventSchema = new mongoose.Schema({
  over: { type: Number, required: true },
  ball: { type: Number, required: true },
  overString: { type: String, required: true },
  event: { type: String, required: true }, // Ensure event is required
  team: { type: String, required: true },
  batsman: { type: String, required: true },
  bowler: { type: String, required: true },
  wicketType: { type: String }, // Optional
  runsOnWicket: { type: Number, default: 0 }, // Optional, defaults to 0
  extraRuns: { type: Number, default: 0 }, // Optional, defaults to 0
  additionalRuns: { type: Number, default: 0 }, // Optional, defaults to 0
});

const matchSchema = new mongoose.Schema({
  team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  overs: { type: Number, required: true },
  toss: { type: String },
  currentBattingTeam: { type: String, enum: ['team1', 'team2'] },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed'], default: 'scheduled' },
  score: {
    team1: scoreSchema,
    team2: scoreSchema,
  },
  ballByBall: [ballEventSchema],
  currentPartnership: {
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
  },
  currentBatsmen: {
    striker: playerStatsSchema,
    nonStriker: playerStatsSchema,
  },
  currentBowler: playerStatsSchema,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Match', matchSchema);