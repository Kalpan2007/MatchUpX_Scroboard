const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  out: { type: Boolean, default: false },
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [playerSchema],
});

module.exports = mongoose.model('Team', teamSchema);