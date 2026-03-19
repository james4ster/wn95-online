// Stats.jsx — Manager Stats + H2H + Team Stats
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();
const norm = (s) => (s || '').toString().trim().toLowerCase();

const ASC_DEFAULT = new Set([
  'l',
  't',
  'hl',
  'htie',
  'al',
  'atie',
  'otl',
  'hotl',
  'aotl',
  'ga',
  'gapg',
]);

const MANAGER_COLS = [
  {
    key: 'rank',
    label: '#',
    tip: 'Rank',
    sortable: false,
    align: 'center',
    group: 'core',
  },
  {
    key: 'mgr',
    label: 'COACH',
    tip: 'Manager / Coach',
    sortable: true,
    align: 'left',
    group: 'core',
  },
  {
    key: 'gp',
    label: 'GP',
    tip: 'Games Played',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'w',
    label: 'W',
    tip: 'Wins',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'l',
    label: 'L',
    tip: 'Losses',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 't',
    label: 'T',
    tip: 'Ties',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'otl',
    label: 'OTL',
    tip: 'Overtime Losses',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'pct',
    label: 'WIN%',
    tip: 'Win Percentage',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'gf',
    label: 'GF',
    tip: 'Goals For',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'ga',
    label: 'GA',
    tip: 'Goals Against',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'diff',
    label: '+/-',
    tip: 'Goal Differential',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'gfpg',
    label: 'GF/G',
    tip: 'Goals For per Game',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'gapg',
    label: 'GA/G',
    tip: 'Goals Against per Game',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'hw',
    label: 'W',
    tip: 'Home Wins',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'hl',
    label: 'L',
    tip: 'Home Losses',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'htie',
    label: 'T',
    tip: 'Home Ties',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'hotl',
    label: 'OTL',
    tip: 'Home OT Losses',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'aw',
    label: 'W',
    tip: 'Away Wins',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'al',
    label: 'L',
    tip: 'Away Losses',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'atie',
    label: 'T',
    tip: 'Away Ties',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'aotl',
    label: 'OTL',
    tip: 'Away OT Losses',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'so',
    label: 'SO',
    tip: 'Shutouts (opponent scored 0)',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'maxgf',
    label: 'MAX G',
    tip: 'Most Goals Scored in a Single Game',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'champs',
    label: '🏆',
    tip: 'Championships Won',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
];

const H2H_COLS = [
  {
    key: 'rank',
    label: '#',
    tip: 'Rank',
    sortable: false,
    align: 'center',
    group: 'core',
  },
  {
    key: 'opp',
    label: 'OPP',
    tip: 'Opponent Coach',
    sortable: true,
    align: 'left',
    group: 'core',
  },
  {
    key: 'gp',
    label: 'GP',
    tip: 'Games Played',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'w',
    label: 'W',
    tip: 'Wins',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'l',
    label: 'L',
    tip: 'Losses',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 't',
    label: 'T',
    tip: 'Ties',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'otl',
    label: 'OTL',
    tip: 'Overtime Losses',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'pct',
    label: 'WIN%',
    tip: 'Win Percentage',
    sortable: true,
    align: 'center',
    group: 'record',
  },
  {
    key: 'gf',
    label: 'GF',
    tip: 'Goals For',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'ga',
    label: 'GA',
    tip: 'Goals Against',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'diff',
    label: '+/-',
    tip: 'Goal Differential',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'gfpg',
    label: 'GF/G',
    tip: 'Goals For per Game',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'gapg',
    label: 'GA/G',
    tip: 'Goals Against per Game',
    sortable: true,
    align: 'center',
    group: 'goals',
  },
  {
    key: 'hw',
    label: 'W',
    tip: 'Home Wins',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'hl',
    label: 'L',
    tip: 'Home Losses',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'htie',
    label: 'T',
    tip: 'Home Ties',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'hotl',
    label: 'OTL',
    tip: 'Home OT Losses',
    sortable: true,
    align: 'center',
    group: 'home',
  },
  {
    key: 'aw',
    label: 'W',
    tip: 'Away Wins',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'al',
    label: 'L',
    tip: 'Away Losses',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'atie',
    label: 'T',
    tip: 'Away Ties',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'aotl',
    label: 'OTL',
    tip: 'Away OT Losses',
    sortable: true,
    align: 'center',
    group: 'away',
  },
  {
    key: 'so',
    label: 'SO',
    tip: 'Shutouts (opponent scored 0)',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'maxgf',
    label: 'MAX G',
    tip: 'Most Goals Scored in a Single Game',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'streak',
    label: 'STK',
    tip: 'Current streak vs this opponent',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'longW',
    label: 'LNG W',
    tip: 'Longest winning streak vs this opponent',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
  {
    key: 'longL',
    label: 'LNG L',
    tip: 'Longest losing streak vs this opponent',
    sortable: true,
    align: 'center',
    group: 'extra',
  },
];

// ─── Team Stats Columns ───────────────────────────────────────────────────
const TEAM_COLS = [
  {
    key: 'rank',
    label: '#',
    tip: 'Rank',
    sortable: false,
    align: 'center',
    group: 'core',
  },
  {
    key: 'team',
    label: 'TEAM',
    tip: 'Team',
    sortable: true,
    align: 'left',
    group: 'core',
  },
  {
    key: 'gp',
    label: 'GP',
    tip: 'Games Played',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'gf',
    label: 'GF',
    tip: 'Goals For',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'ga',
    label: 'GA',
    tip: 'Goals Against',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'diff',
    label: '+/-',
    tip: 'Goal Differential',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'gfpg',
    label: 'GF/G',
    tip: 'Goals For per Game',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'gapg',
    label: 'GA/G',
    tip: 'Goals Against per Game',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'pp_g',
    label: 'PPG',
    tip: 'Power Play Goals',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'sh_g',
    label: 'SHG',
    tip: 'Short-Handed Goals',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'ot_g',
    label: 'OTG',
    tip: 'Overtime Goals',
    sortable: true,
    align: 'center',
    group: 'scoring',
  },
  {
    key: 'shots',
    label: 'SF',
    tip: 'Shots For',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'shots_ag',
    label: 'SA',
    tip: 'Shots Against',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'shot_diff',
    label: 'SD',
    tip: 'Shot Differential (SF - SA)',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'sfpg',
    label: 'SF/G',
    tip: 'Shots For per Game',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'sapg',
    label: 'SA/G',
    tip: 'Shots Against per Game',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'shot_pct',
    label: 'S%',
    tip: 'Shooting Percentage (Goals / Shots)',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'sv_pct',
    label: 'SV%',
    tip: 'Save Percentage (1 - GA/SA)',
    sortable: true,
    align: 'center',
    group: 'shots',
  },
  {
    key: 'pp_pct',
    label: 'PP%',
    tip: 'Power Play Percentage',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'pp_g',
    label: 'PPG',
    tip: 'Power Play Goals',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'pp_amt',
    label: 'PPA',
    tip: 'Power Play Attempts',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'pp_shots',
    label: 'PPS',
    tip: 'Power Play Shots',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'pp_time_avg',
    label: 'PP/G',
    tip: 'Avg Power Play Time per Game (mm:ss)',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'sh_time_avg',
    label: 'SH/G',
    tip: 'Avg Short-Handed Time per Game (opponent PP, mm:ss)',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'ps_att',
    label: 'PSA',
    tip: 'Penalty Shot Attempts',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'ps_g',
    label: 'PSG',
    tip: 'Penalty Shot Goals',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'ps_pct',
    label: 'PS%',
    tip: 'Penalty Shot Percentage',
    sortable: true,
    align: 'center',
    group: 'special',
  },
  {
    key: 'fo_won',
    label: 'FOW',
    tip: 'Faceoffs Won',
    sortable: true,
    align: 'center',
    group: 'faceoff',
  },
  {
    key: 'fo_total',
    label: 'FOT',
    tip: 'Faceoffs Total',
    sortable: true,
    align: 'center',
    group: 'faceoff',
  },
  {
    key: 'fo_pct',
    label: 'FO%',
    tip: 'Faceoff Win Percentage',
    sortable: true,
    align: 'center',
    group: 'faceoff',
  },
  {
    key: 'pass_att',
    label: 'PAT',
    tip: 'Pass Attempts',
    sortable: true,
    align: 'center',
    group: 'passing',
  },
  {
    key: 'pass_comp',
    label: 'PC',
    tip: 'Pass Completions',
    sortable: true,
    align: 'center',
    group: 'passing',
  },
  {
    key: 'pass_pct',
    label: 'P%',
    tip: 'Pass Completion Percentage',
    sortable: true,
    align: 'center',
    group: 'passing',
  },
  {
    key: 'pass_att_pg',
    label: 'PAT/G',
    tip: 'Pass Attempts per Game',
    sortable: true,
    align: 'center',
    group: 'passing',
  },
  {
    key: 'pass_comp_pg',
    label: 'PC/G',
    tip: 'Pass Completions per Game',
    sortable: true,
    align: 'center',
    group: 'passing',
  },
  {
    key: 'chk',
    label: 'CHK',
    tip: 'Checks',
    sortable: true,
    align: 'center',
    group: 'physical',
  },
  {
    key: 'chk_ag',
    label: 'CHKA',
    tip: 'Checks Against',
    sortable: true,
    align: 'center',
    group: 'physical',
  },
  {
    key: 'chk_pg',
    label: 'CHK/G',
    tip: 'Checks per Game',
    sortable: true,
    align: 'center',
    group: 'physical',
  },
  {
    key: 'chk_ag_pg',
    label: 'CHKA/G',
    tip: 'Checks Against per Game',
    sortable: true,
    align: 'center',
    group: 'physical',
  },
  {
    key: 'break_g',
    label: 'BRG',
    tip: 'Breakaway Goals',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'break_att',
    label: 'BRA',
    tip: 'Breakaway Attempts',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'break_pct',
    label: 'BR%',
    tip: 'Breakaway Goal Percentage',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'xa_shots',
    label: '1XA',
    tip: 'Expected Goals Shots (1XA)',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'xg',
    label: '1XG',
    tip: 'Expected Goals (1XG)',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'xg_pct',
    label: '1X%',
    tip: '1X Conversion Rate (1XG / 1XA)',
    sortable: true,
    align: 'center',
    group: 'danger',
  },
  {
    key: 'atk_time_avg',
    label: 'ATK/G',
    tip: 'Avg Attack Zone Time per Game (mm:ss)',
    sortable: true,
    align: 'center',
    group: 'time',
  },
  {
    key: 'def_time_avg',
    label: 'DEF/G',
    tip: 'Avg Defensive Zone Time per Game (mm:ss)',
    sortable: true,
    align: 'center',
    group: 'time',
  },
  // Period scoring
  {
    key: 'p1_gf',
    label: '1GF',
    tip: 'Period 1 Goals For',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'p1_ga',
    label: '1GA',
    tip: 'Period 1 Goals Against',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'p2_gf',
    label: '2GF',
    tip: 'Period 2 Goals For',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'p2_ga',
    label: '2GA',
    tip: 'Period 2 Goals Against',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'p3_gf',
    label: '3GF',
    tip: 'Period 3 Goals For',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'p3_ga',
    label: '3GA',
    tip: 'Period 3 Goals Against',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'ot_gf',
    label: 'OGF',
    tip: 'Overtime Goals For',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
  {
    key: 'ot_ga',
    label: 'OGA',
    tip: 'Overtime Goals Against',
    sortable: true,
    align: 'center',
    group: 'periods',
  },
];

// dedupe pp_g which appears in both scoring and special
const TEAM_COLS_DEDUPED = (() => {
  const seen = new Set();
  const result = [];
  for (const col of TEAM_COLS) {
    const uniq = `${col.key}-${col.group}`;
    if (!seen.has(uniq)) {
      seen.add(uniq);
      result.push(col);
    }
  }
  return result;
})();

const GROUPS = {
  core: {
    label: '',
    headerBg: '#07071a',
    cellBg: '#07071a',
    groupBg: '#07071a',
    groupText: 'rgba(255,255,255,.3)',
    borderLeft: 'none',
  },
  record: {
    label: 'RECORD',
    headerBg: 'rgba(160,170,255,.09)',
    cellBg: 'rgba(100,110,200,.055)',
    groupBg: 'rgba(160,170,255,.17)',
    groupText: 'rgba(185,195,255,.9)',
    borderLeft: '3px solid rgba(140,150,255,.5)',
  },
  goals: {
    label: 'GOALS',
    headerBg: 'rgba(255,140,0,.11)',
    cellBg: 'rgba(255,120,0,.065)',
    groupBg: 'rgba(255,140,0,.2)',
    groupText: 'rgba(255,175,75,.95)',
    borderLeft: '3px solid rgba(255,140,0,.6)',
  },
  home: {
    label: 'HOME',
    headerBg: 'rgba(80,165,255,.11)',
    cellBg: 'rgba(60,140,255,.065)',
    groupBg: 'rgba(100,175,255,.2)',
    groupText: 'rgba(145,215,255,.95)',
    borderLeft: '3px solid rgba(100,170,255,.6)',
  },
  away: {
    label: 'AWAY',
    headerBg: 'rgba(170,110,255,.11)',
    cellBg: 'rgba(150,90,240,.065)',
    groupBg: 'rgba(180,120,255,.2)',
    groupText: 'rgba(205,165,255,.95)',
    borderLeft: '3px solid rgba(175,115,255,.6)',
  },
  extra: {
    label: 'EXTRA',
    headerBg: 'rgba(255,215,0,.09)',
    cellBg: 'rgba(230,195,0,.05)',
    groupBg: 'rgba(255,215,0,.17)',
    groupText: 'rgba(255,220,60,.95)',
    borderLeft: '3px solid rgba(255,215,0,.5)',
  },
  // Team stats groups
  scoring: {
    label: 'SCORING',
    headerBg: 'rgba(255,140,0,.11)',
    cellBg: 'rgba(255,120,0,.065)',
    groupBg: 'rgba(255,140,0,.2)',
    groupText: 'rgba(255,175,75,.95)',
    borderLeft: '3px solid rgba(255,140,0,.6)',
  },
  shots: {
    label: 'SHOTS',
    headerBg: 'rgba(80,165,255,.11)',
    cellBg: 'rgba(60,140,255,.065)',
    groupBg: 'rgba(100,175,255,.2)',
    groupText: 'rgba(145,215,255,.95)',
    borderLeft: '3px solid rgba(100,170,255,.6)',
  },
  special: {
    label: 'SPECIAL TEAMS',
    headerBg: 'rgba(170,110,255,.11)',
    cellBg: 'rgba(150,90,240,.065)',
    groupBg: 'rgba(180,120,255,.2)',
    groupText: 'rgba(205,165,255,.95)',
    borderLeft: '3px solid rgba(175,115,255,.6)',
  },
  faceoff: {
    label: 'FACEOFFS',
    headerBg: 'rgba(0,210,160,.10)',
    cellBg: 'rgba(0,185,140,.055)',
    groupBg: 'rgba(0,210,160,.18)',
    groupText: 'rgba(100,240,200,.9)',
    borderLeft: '3px solid rgba(0,210,160,.5)',
  },
  passing: {
    label: 'PASSING',
    headerBg: 'rgba(255,215,0,.09)',
    cellBg: 'rgba(230,195,0,.05)',
    groupBg: 'rgba(255,215,0,.17)',
    groupText: 'rgba(255,220,60,.95)',
    borderLeft: '3px solid rgba(255,215,0,.5)',
  },
  physical: {
    label: 'PHYSICAL',
    headerBg: 'rgba(255,80,80,.10)',
    cellBg: 'rgba(220,60,60,.055)',
    groupBg: 'rgba(255,80,80,.18)',
    groupText: 'rgba(255,150,150,.9)',
    borderLeft: '3px solid rgba(255,80,80,.5)',
  },
  danger: {
    label: 'DANGER',
    headerBg: 'rgba(255,60,120,.10)',
    cellBg: 'rgba(220,40,100,.055)',
    groupBg: 'rgba(255,60,120,.18)',
    groupText: 'rgba(255,140,180,.9)',
    borderLeft: '3px solid rgba(255,60,120,.5)',
  },
  time: {
    label: 'ZONE TIME',
    headerBg: 'rgba(160,170,255,.09)',
    cellBg: 'rgba(100,110,200,.055)',
    groupBg: 'rgba(160,170,255,.17)',
    groupText: 'rgba(185,195,255,.9)',
    borderLeft: '3px solid rgba(140,150,255,.5)',
  },
  periods: {
    label: 'BY PERIOD',
    headerBg: 'rgba(0,210,160,.10)',
    cellBg: 'rgba(0,185,140,.055)',
    groupBg: 'rgba(0,210,160,.18)',
    groupText: 'rgba(100,240,200,.9)',
    borderLeft: '3px solid rgba(0,210,160,.5)',
  },
};

const LOSS_KEYS = new Set([
  'l',
  't',
  'htie',
  'atie',
  'hl',
  'al',
  'otl',
  'hotl',
  'aotl',
  'ga',
  'gapg',
]);
const SEASON_VALS = new Set([
  'REG',
  'REGULAR',
  'SEASON',
  'S',
  'RS',
  'REGULAR SEASON',
]);
const PLAYOFF_VALS = new Set([
  'PO',
  'PLAYOFF',
  'PLAYOFFS',
  'P',
  'POST',
  'POSTSEASON',
]);

// Team stat columns that are "bad when high"
const TEAM_LOSS_KEYS = new Set([
  'ga',
  'gapg',
  'sapg',
  'chk_ag',
  'chk_ag_pg',
  'def_time_avg',
  'sh_time_avg',
  'p1_ga',
  'p2_ga',
  'p3_ga',
  'ot_ga',
]);

function deriveResult(sh, sa, ot, side) {
  if (sh === sa) return 'T';
  const won = side === 'home' ? sh > sa : sa > sh;
  if (won) return ot ? 'OTW' : 'W';
  return ot ? 'OTL' : 'L';
}

// ─── Time parsing helper ─────────────────────────────────────────────────
// DB stores times as "HH:MM:SS" where HH is actually minutes, MM is seconds
// e.g. "07:38:00" means 7 minutes 38 seconds, NOT 7 hours 38 minutes
// So we always take the first two parts as MM:SS and ignore the third
function parseTimeToSeconds(val) {
  if (!val) return 0;
  const str = String(val).trim();
  const parts = str.split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1]; // MM:SS
  return 0;
}

function secondsToMMSS(secs) {
  if (!secs && secs !== 0) return '–';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Player stats aggregation ─────────────────────────────────────────────
function buildPlayerStats(rows) {
  const m = new Map();

  const ensurePlayer = (name, team) => {
    if (!name) return null;
    const key = name.trim();
    if (!m.has(key)) {
      m.set(key, {
        name: key,
        team: team || '',
        goals: 0,
        primary_assists: 0,
        secondary_assists: 0,
        pp_goals: 0,
        sh_goals: 0,
        ev_goals: 0,
        gwg: 0,
        _goalsByGame: {},
        _assistsByGame: {},
        _pointsByGame: {},
      });
    }
    return m.get(key);
  };

  for (const r of rows) {
    const gameKey = r.playoff_game_id
      ? `po-${r.playoff_game_id}`
      : `s-${r.game_id}`;
    const scoreType = (r.score_type || 'EV').toUpperCase();
    if (r.goal_player_name) {
      const p = ensurePlayer(r.goal_player_name, r.g_team);
      if (p) {
        p.goals++;
        p.team = r.g_team || p.team;
        if (!p._goalsByGame[gameKey]) p._goalsByGame[gameKey] = 0;
        p._goalsByGame[gameKey]++;
        if (!p._pointsByGame[gameKey]) p._pointsByGame[gameKey] = 0;
        p._pointsByGame[gameKey]++;
        if (scoreType === 'PP') p.pp_goals++;
        else if (scoreType === 'SH') p.sh_goals++;
        else p.ev_goals++;
        if (r._isGWG) p.gwg++;
      }
    }
    if (r.assist_primary_name) {
      const p = ensurePlayer(r.assist_primary_name, r.g_team);
      if (p) {
        p.primary_assists++;
        if (!p._assistsByGame[gameKey]) p._assistsByGame[gameKey] = 0;
        p._assistsByGame[gameKey]++;
        if (!p._pointsByGame[gameKey]) p._pointsByGame[gameKey] = 0;
        p._pointsByGame[gameKey]++;
      }
    }
    if (r.assist_secondary_name) {
      const p = ensurePlayer(r.assist_secondary_name, r.g_team);
      if (p) {
        p.secondary_assists++;
        if (!p._assistsByGame[gameKey]) p._assistsByGame[gameKey] = 0;
        p._assistsByGame[gameKey]++;
        if (!p._pointsByGame[gameKey]) p._pointsByGame[gameKey] = 0;
        p._pointsByGame[gameKey]++;
      }
    }
  }

  return Array.from(m.values()).map(
    ({ _goalsByGame, _assistsByGame, _pointsByGame, ...s }) => {
      const assists = s.primary_assists + s.secondary_assists;
      const pts = s.goals + assists;
      const gp = new Set(Object.keys(_pointsByGame)).size;

      let hat_tricks = 0;
      let multi_goal_games = 0;
      let best_goals = 0;
      for (const count of Object.values(_goalsByGame)) {
        if (count >= 3) hat_tricks++;
        if (count >= 2) multi_goal_games++;
        if (count > best_goals) best_goals = count;
      }
      let multi_point_games = 0;
      let best_points = 0;
      for (const count of Object.values(_pointsByGame)) {
        if (count >= 2) multi_point_games++;
        if (count > best_points) best_points = count;
      }
      let best_assists = 0;
      for (const count of Object.values(_assistsByGame || {})) {
        if (count > best_assists) best_assists = count;
      }

      return {
        ...s,
        assists,
        pts,
        gp,
        hat_tricks,
        multi_goal_games,
        multi_point_games,
        best_goals,
        best_assists,
        best_points,
        ptspg: gp > 0 ? +(pts / gp).toFixed(2) : 0,
        gpg_rate: gp > 0 ? +(s.goals / gp).toFixed(2) : 0,
        apg: gp > 0 ? +(assists / gp).toFixed(2) : 0,
      };
    }
  );
}

// ─── Team stats aggregation ───────────────────────────────────────────────
function buildTeamStats(rows) {
  const m = new Map();

  const slot = (code) => {
    if (!code) return null;
    const key = code.trim().toUpperCase();
    if (!m.has(key))
      m.set(key, {
        team: key,
        gp: 0,
        gf: 0,
        ga: 0,
        shots: 0,
        shots_ag: 0,
        pp_g: 0,
        pp_amt: 0,
        pp_shots: 0,
        sh_g: 0,
        ot_g: 0,
        ps_att: 0,
        ps_g: 0,
        fo_won: 0,
        fo_total: 0,
        pass_att: 0,
        pass_comp: 0,
        chk: 0,
        chk_ag: 0,
        break_att: 0,
        break_g: 0,
        xa_shots: 0,
        xg: 0,
        atk_secs: 0,
        def_secs: 0,
        pp_secs: 0, // total PP time (own power plays)
        sh_secs: 0, // total SH time (opponent PP = our penalty kill)
        // period goals
        p1_gf: 0,
        p1_ga: 0,
        p2_gf: 0,
        p2_ga: 0,
        p3_gf: 0,
        p3_ga: 0,
        ot_gf: 0,
        ot_ga: 0,
      });
    return m.get(key);
  };

  for (const g of rows) {
    const home = slot(g.home);
    const away = slot(g.away);
    if (!home || !away) continue;

    // --- HOME ---
    home.gp++;
    home.gf += Number(g.home_score || 0);
    home.ga += Number(g.away_score || 0);
    home.shots += Number(g.home_shots || 0);
    home.shots_ag += Number(g.away_shots || 0);
    home.pp_g += Number(g.home_pp_g || 0);
    home.pp_amt += Number(g.home_pp_amt || 0);
    home.pp_shots += Number(g.home_pp_shots || 0);
    home.sh_g += Number(g.home_shg || 0);
    home.ps_att += Number(g.home_ps || 0);
    home.ps_g += Number(g.home_psg || 0);
    home.fo_won += Number(g.home_fow || 0);
    home.fo_total += Number(g.fo_total || 0);
    home.pass_att += Number(g.home_pass_attempts || 0);
    home.pass_comp += Number(g.home_pass_complete || 0);
    home.chk += Number(g.home_chk || 0);
    home.chk_ag += Number(g.away_chk || 0);
    home.break_att += Number(g.home_break_attempts || 0);
    home.break_g += Number(g.home_break_goals || 0);
    home.xa_shots += Number(g.home_1xa || 0);
    home.xg += Number(g.home_1xg || 0);
    home.atk_secs += parseTimeToSeconds(g.home_attack);
    home.def_secs += parseTimeToSeconds(g.away_attack);
    home.pp_secs += parseTimeToSeconds(g.home_pp_mins);
    home.sh_secs += parseTimeToSeconds(g.away_pp_mins); // opponent's PP = our SH
    home.p1_gf += Number(g.home_1p_g || 0);
    home.p1_ga += Number(g.away_1p_g || 0);
    home.p2_gf += Number(g.home_2p_g || 0);
    home.p2_ga += Number(g.away_2p_g || 0);
    home.p3_gf += Number(g.home_3p_g || 0);
    home.p3_ga += Number(g.away_3p_g || 0);

    // --- AWAY ---
    away.gp++;
    away.gf += Number(g.away_score || 0);
    away.ga += Number(g.home_score || 0);
    away.shots += Number(g.away_shots || 0);
    away.shots_ag += Number(g.home_shots || 0);
    away.pp_g += Number(g.away_pp_g || 0);
    away.pp_amt += Number(g.away_pp_amt || 0);
    away.pp_shots += Number(g.away_pp_shots || 0);
    away.sh_g += Number(g.away_shg || 0);
    away.ps_att += Number(g.away_ps || 0);
    away.ps_g += Number(g.away_psg || 0);
    away.fo_won += Number(g.away_fow || 0);
    away.fo_total += Number(g.fo_total || 0);
    away.pass_att += Number(g.away_pass_attempts || 0);
    away.pass_comp += Number(g.away_pass_complete || 0);
    away.chk += Number(g.away_chk || 0);
    away.chk_ag += Number(g.home_chk || 0);
    away.break_att += Number(g.away_break_attempts || 0);
    away.break_g += Number(g.away_break_goals || 0);
    away.xa_shots += Number(g.away_1xa || 0);
    away.xg += Number(g.away_1xg || 0);
    away.atk_secs += parseTimeToSeconds(g.away_attack);
    away.def_secs += parseTimeToSeconds(g.home_attack);
    away.pp_secs += parseTimeToSeconds(g.away_pp_mins);
    away.sh_secs += parseTimeToSeconds(g.home_pp_mins); // opponent's PP = our SH
    away.p1_gf += Number(g.away_1p_g || 0);
    away.p1_ga += Number(g.home_1p_g || 0);
    away.p2_gf += Number(g.away_2p_g || 0);
    away.p2_ga += Number(g.home_2p_g || 0);
    away.p3_gf += Number(g.away_3p_g || 0);
    away.p3_ga += Number(g.home_3p_g || 0);
    away.ot_gf += Number(g.away_ot_g || 0);
    away.ot_ga += Number(g.home_ot_g || 0);

    // Derive OT goals from ot_flag — winner always scores exactly 1 OT goal
    if (Number(g.ot_flag) === 1) {
      const homeWon = Number(g.home_score || 0) > Number(g.away_score || 0);
      home.ot_g += homeWon ? 1 : 0;
      away.ot_g += homeWon ? 0 : 1;
      home.ot_gf += homeWon ? 1 : 0;
      home.ot_ga += homeWon ? 0 : 1;
      away.ot_gf += homeWon ? 0 : 1;
      away.ot_ga += homeWon ? 1 : 0;
    }
  }

  return Array.from(m.values()).map((s) => {
    const gp = s.gp || 1;
    return {
      ...s,
      diff: s.gf - s.ga,
      shot_diff: s.shots - s.shots_ag,
      gfpg: +(s.gf / gp).toFixed(2),
      gapg: +(s.ga / gp).toFixed(2),
      sfpg: +(s.shots / gp).toFixed(2),
      sapg: +(s.shots_ag / gp).toFixed(2),
      shot_pct: s.shots > 0 ? +((s.gf / s.shots) * 100).toFixed(1) : 0,
      sv_pct: s.shots_ag > 0 ? +((1 - s.ga / s.shots_ag) * 100).toFixed(1) : 0,
      pp_pct: s.pp_amt > 0 ? +((s.pp_g / s.pp_amt) * 100).toFixed(1) : 0,
      ps_pct: s.ps_att > 0 ? +((s.ps_g / s.ps_att) * 100).toFixed(1) : 0,
      fo_pct: s.fo_total > 0 ? +((s.fo_won / s.fo_total) * 100).toFixed(1) : 0,
      pass_pct:
        s.pass_att > 0 ? +((s.pass_comp / s.pass_att) * 100).toFixed(1) : 0,
      pass_att_pg: +(s.pass_att / gp).toFixed(1),
      pass_comp_pg: +(s.pass_comp / gp).toFixed(1),
      chk_pg: +(s.chk / gp).toFixed(1),
      chk_ag_pg: +(s.chk_ag / gp).toFixed(1),
      break_pct:
        s.break_att > 0 ? +((s.break_g / s.break_att) * 100).toFixed(1) : 0,
      xg_pct: s.xa_shots > 0 ? +((s.xg / s.xa_shots) * 100).toFixed(1) : 0,
      atk_time_avg: s.atk_secs / gp,
      def_time_avg: s.def_secs / gp,
      pp_time_avg: s.pp_secs / gp,
      sh_time_avg: s.sh_secs / gp,
    };
  });
}

// ─── Manager stats aggregation ────────────────────────────────────────────
function buildManagerStats(games, champMap) {
  const m = new Map();
  const slot = (normKey) => {
    if (!normKey) return null;
    if (!m.has(normKey))
      m.set(normKey, {
        normKey,
        gp: 0,
        w: 0,
        l: 0,
        t: 0,
        otl: 0,
        gf: 0,
        ga: 0,
        hw: 0,
        hl: 0,
        htie: 0,
        hotl: 0,
        aw: 0,
        al: 0,
        atie: 0,
        aotl: 0,
        so: 0,
        maxgf: 0,
        _displayName: '',
      });
    return m.get(normKey);
  };

  for (const g of games) {
    const hCoach = (g.coach_home || '').trim();
    const aCoach = (g.coach_away || '').trim();
    if (!hCoach || !aCoach) continue;
    const h = slot(norm(hCoach)),
      a = slot(norm(aCoach));
    if (!h || !a) continue;
    if (!h._displayName) h._displayName = hCoach;
    if (!a._displayName) a._displayName = aCoach;

    const sh = Number(g.score_home || 0),
      sa = Number(g.score_away || 0);
    const ot = !!g.ot;
    h.gp++;
    a.gp++;
    h.gf += sh;
    h.ga += sa;
    h.maxgf = Math.max(h.maxgf, sh);
    a.gf += sa;
    a.ga += sh;
    a.maxgf = Math.max(a.maxgf, sa);

    const hr = deriveResult(sh, sa, ot, 'home');
    const ar = deriveResult(sh, sa, ot, 'away');

    if (hr === 'W') {
      h.w++;
      h.hw++;
    } else if (hr === 'OTW') {
      h.w++;
      h.hw++;
    } else if (hr === 'T') {
      h.t++;
      h.htie++;
    } else if (hr === 'OTL') {
      h.otl++;
      h.hotl++;
    } else {
      h.l++;
      h.hl++;
    }

    if (ar === 'W') {
      a.w++;
      a.aw++;
    } else if (ar === 'OTW') {
      a.w++;
      a.aw++;
    } else if (ar === 'T') {
      a.t++;
      a.atie++;
    } else if (ar === 'OTL') {
      a.otl++;
      a.aotl++;
    } else {
      a.l++;
      a.al++;
    }

    if (sa === 0) h.so++;
    if (sh === 0) a.so++;
  }

  return Array.from(m.values()).map((s) => ({
    ...s,
    mgr: s.normKey,
    pct: s.gp ? s.w / s.gp : 0,
    gfpg: s.gp ? +(s.gf / s.gp).toFixed(2) : 0,
    gapg: s.gp ? +(s.ga / s.gp).toFixed(2) : 0,
    diff: s.gf - s.ga,
    champs: champMap.get(s.normKey) ?? null,
  }));
}

// ─── H2H aggregation ─────────────────────────────────────────────────────
function buildH2HStats(games, mgrANorm, mgrBNorm) {
  const relevant = games.filter((g) => {
    const h = norm(g.coach_home || '');
    const a = norm(g.coach_away || '');
    if (h !== mgrANorm && a !== mgrANorm) return false;
    if (mgrBNorm && mgrBNorm !== 'ALL') {
      return h === mgrBNorm || a === mgrBNorm;
    }
    return h !== mgrANorm || a !== mgrANorm;
  });

  const oppMap = new Map();
  const sorted = [...relevant].sort((a, b) => (a.id || 0) - (b.id || 0));

  for (const g of sorted) {
    const hCoach = norm(g.coach_home || '');
    const aCoach = norm(g.coach_away || '');
    const aIsHome = hCoach === mgrANorm;
    const oppNorm = aIsHome ? aCoach : hCoach;
    const oppDisplay = aIsHome
      ? (g.coach_away || '').trim()
      : (g.coach_home || '').trim();
    if (!oppNorm || oppNorm === mgrANorm) continue;

    if (!oppMap.has(oppNorm)) {
      oppMap.set(oppNorm, {
        oppNorm,
        oppDisplay,
        gp: 0,
        w: 0,
        l: 0,
        t: 0,
        otl: 0,
        gf: 0,
        ga: 0,
        hw: 0,
        hl: 0,
        htie: 0,
        hotl: 0,
        aw: 0,
        al: 0,
        atie: 0,
        aotl: 0,
        so: 0,
        maxgf: 0,
        _results: [],
      });
    }
    const row = oppMap.get(oppNorm);

    const sh = Number(g.score_home || 0),
      sa = Number(g.score_away || 0);
    const ot = !!g.ot;
    const myScore = aIsHome ? sh : sa;
    const oppScore = aIsHome ? sa : sh;
    const side = aIsHome ? 'home' : 'away';
    const res = deriveResult(sh, sa, ot, side);

    row.gp++;
    row.gf += myScore;
    row.ga += oppScore;
    row.maxgf = Math.max(row.maxgf, myScore);
    if (oppScore === 0) row.so++;

    if (aIsHome) {
      if (res === 'W' || res === 'OTW') {
        row.w++;
        row.hw++;
      } else if (res === 'T') {
        row.t++;
        row.htie++;
      } else if (res === 'OTL') {
        row.otl++;
        row.hotl++;
      } else {
        row.l++;
        row.hl++;
      }
    } else {
      if (res === 'W' || res === 'OTW') {
        row.w++;
        row.aw++;
      } else if (res === 'T') {
        row.t++;
        row.atie++;
      } else if (res === 'OTL') {
        row.otl++;
        row.aotl++;
      } else {
        row.l++;
        row.al++;
      }
    }

    row._results.push(res === 'OTW' ? 'W' : res);
  }

  const computeStreak = (results) => {
    if (!results.length) return '–';
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i] === last) count++;
      else break;
    }
    return `${last}${count}`;
  };

  const computeLongest = (results, target) => {
    let max = 0,
      cur = 0;
    for (const r of results) {
      if (r === target) {
        cur++;
        max = Math.max(max, cur);
      } else cur = 0;
    }
    return max;
  };

  return Array.from(oppMap.values()).map(({ _results, ...s }) => ({
    ...s,
    opp: s.oppNorm,
    pct: s.gp ? s.w / s.gp : 0,
    gfpg: s.gp ? +(s.gf / s.gp).toFixed(2) : 0,
    gapg: s.gp ? +(s.ga / s.gp).toFixed(2) : 0,
    diff: s.gf - s.ga,
    streak: computeStreak(_results),
    longW: computeLongest(_results, 'W'),
    longL: computeLongest(_results, 'L'),
    _streakVal: (() => {
      if (!_results.length) return 0;
      const last = _results[_results.length - 1];
      let count = 0;
      for (let i = _results.length - 1; i >= 0; i--) {
        if (_results[i] === last) count++;
        else break;
      }
      return last === 'W' ? count : last === 'L' ? -count : 0;
    })(),
  }));
}

// ─── Formatting helpers ───────────────────────────────────────────────────
function fmtChamps(v, isAllSeasons) {
  if (v === null || v === undefined) return '–';
  if (isAllSeasons) {
    const n = Number(v);
    if (!n) return '–';
    if (n <= 3) return '🏆'.repeat(n);
    return `🏆 ×${n}`;
  }
  return v ? '🏆' : '–';
}

function fmtVal(v, key, isAllSeasons) {
  if (v === null || v === undefined) return '–';
  if (key === 'champs') return fmtChamps(v, isAllSeasons);
  if (key === 'streak') return v || '–';
  if (key === 'longW') return Number(v) > 0 ? String(v) : '–';
  if (key === 'longL') return Number(v) > 0 ? String(v) : '–';
  if (key === 'pct') {
    const n = Number(v);
    if (!isFinite(n)) return '–';
    return n === 1 ? '1.000' : n.toFixed(3).replace(/^0/, '');
  }
  if (key === 'gfpg' || key === 'gapg') return Number(v).toFixed(2);
  if (key === 'diff' || key === 'shot_diff') return v > 0 ? `+${v}` : String(v);
  // Team stat percentage fields
  if (
    [
      'shot_pct',
      'sv_pct',
      'pp_pct',
      'ps_pct',
      'fo_pct',
      'pass_pct',
      'break_pct',
      'xg_pct',
    ].includes(key)
  ) {
    const n = Number(v);
    if (!isFinite(n)) return '–';
    return n.toFixed(1) + '%';
  }
  // Time fields — stored as raw seconds, display as MM:SS
  if (
    ['atk_time_avg', 'def_time_avg', 'pp_time_avg', 'sh_time_avg'].includes(key)
  ) {
    return secondsToMMSS(Number(v));
  }
  return String(v);
}

function streakColor(streak) {
  if (!streak || streak === '–') return undefined;
  if (streak.startsWith('W')) return '#00DD55';
  if (streak.startsWith('L')) return '#FF5555';
  return '#87CEEB';
}

// ─── Team logo component ──────────────────────────────────────────────────
function TeamLogo({ code }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  return err ? (
    <div className="td-team-logo-fb">{code.slice(0, 3)}</div>
  ) : (
    <img
      src={`/assets/teamLogos/${code}.png`}
      alt={code}
      className="td-team-logo"
      onError={() => setErr(true)}
    />
  );
}

// ─── Player Stats Table ───────────────────────────────────────────────────
const PLAYER_COLS = [
  { key: 'rank', label: '#', tip: 'Rank', align: 'center' },
  { key: 'name', label: 'PLAYER', tip: 'Player Name', align: 'left' },
  { key: 'team', label: 'TEAM', tip: 'Team', align: 'center' },
  { key: 'gp', label: 'GP', tip: 'Games With a Point', align: 'center' },
  { key: 'pts', label: 'PTS', tip: 'Total Points', align: 'center' },
  { key: 'goals', label: 'G', tip: 'Goals', align: 'center' },
  { key: 'assists', label: 'A', tip: 'Total Assists', align: 'center' },
  {
    key: 'primary_assists',
    label: 'A1',
    tip: 'Primary Assists',
    align: 'center',
  },
  {
    key: 'secondary_assists',
    label: 'A2',
    tip: 'Secondary Assists',
    align: 'center',
  },
  { key: 'ptspg', label: 'P/G', tip: 'Points per Game', align: 'center' },
  { key: 'gpg_rate', label: 'G/G', tip: 'Goals per Game', align: 'center' },
  { key: 'apg', label: 'A/G', tip: 'Assists per Game', align: 'center' },
  { key: 'pp_goals', label: 'PPG', tip: 'Power Play Goals', align: 'center' },
  { key: 'sh_goals', label: 'SHG', tip: 'Short-Handed Goals', align: 'center' },
  {
    key: 'ev_goals',
    label: 'EVG',
    tip: 'Even Strength Goals',
    align: 'center',
  },
  { key: 'gwg', label: 'GWG', tip: 'Game Winning Goals', align: 'center' },
  {
    key: 'hat_tricks',
    label: 'HT',
    tip: 'Hat Tricks (3+ goals/game)',
    align: 'center',
  },
  {
    key: 'multi_goal_games',
    label: 'MGG',
    tip: 'Multi-Goal Games (2+)',
    align: 'center',
  },
  {
    key: 'multi_point_games',
    label: 'MPG',
    tip: 'Multi-Point Games (2+)',
    align: 'center',
  },
  {
    key: 'best_goals',
    label: 'G',
    tip: 'Most Goals in a Single Game',
    align: 'center',
  },
  {
    key: 'best_assists',
    label: 'A',
    tip: 'Most Assists in a Single Game',
    align: 'center',
  },
  {
    key: 'best_points',
    label: 'P',
    tip: 'Most Points in a Single Game',
    align: 'center',
  },
];

// Column index boundaries:
// 0-2: core (3 cols)
// 3-8: scoring (6 cols)
// 9-11: per game (3 cols)
// 12-15: goal type (4 cols)
// 16-21: milestones (6 cols)
const PLAYER_COL_GROUP = (ci) =>
  ci < 3 ? 0 : ci < 9 ? 1 : ci < 12 ? 2 : ci < 16 ? 3 : 4;

const PLAYER_GROUP_SPANS = [
  {
    label: '',
    cols: 3,
    bg: '#07071a',
    border: 'none',
    text: 'rgba(255,255,255,.3)',
  },
  {
    label: 'SCORING',
    cols: 6,
    bg: 'rgba(255,140,0,.2)',
    border: '3px solid rgba(255,140,0,.6)',
    text: 'rgba(255,175,75,.95)',
  },
  {
    label: 'PER GAME',
    cols: 3,
    bg: 'rgba(80,165,255,.2)',
    border: '3px solid rgba(100,170,255,.6)',
    text: 'rgba(145,215,255,.95)',
  },
  {
    label: 'GOAL TYPE',
    cols: 4,
    bg: 'rgba(170,110,255,.2)',
    border: '3px solid rgba(175,115,255,.6)',
    text: 'rgba(205,165,255,.95)',
  },
  {
    label: 'MILESTONES',
    cols: 6,
    bg: 'rgba(0,180,120,.15)',
    border: '3px solid rgba(0,210,140,.5)',
    text: 'rgba(100,240,200,.95)',
  },
];

// First column index of each group (for border-left logic)
const PLAYER_GROUP_FIRST = new Set([0, 3, 9, 12, 16]);

function PlayerStatsTable({ rows, sortKey, sortDir, onSort }) {
  const maxVals = useMemo(() => {
    const mv = {};
    for (const col of PLAYER_COLS) {
      if (!['rank', 'name', 'team'].includes(col.key)) {
        const vals = rows.map((r) => Number(r[col.key] || 0)).filter(isFinite);
        mv[col.key] = vals.length ? Math.max(...vals) : 1;
      }
    }
    return mv;
  }, [rows]);

  const tableRef = useRef(null);
  const [rankColW, setRankColW] = useState(40);
  useEffect(() => {
    if (!tableRef.current) return;
    const ths = tableRef.current.querySelectorAll('thead tr:last-child th');
    if (ths.length >= 2) setRankColW(ths[0].getBoundingClientRect().width);
  }, [rows]);

  return (
    <table ref={tableRef} className="sp-table">
      <thead>
        <tr>
          {PLAYER_GROUP_SPANS.map((g, i) => (
            <th
              key={i}
              colSpan={g.cols}
              className={`sp-gh${i === 0 ? ' sticky-gh' : ''}`}
              style={{
                background: g.bg,
                color: g.text,
                borderLeft: i > 0 ? g.border : 'none',
                ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 12 } : {}),
              }}
            >
              {g.label}
            </th>
          ))}
        </tr>
        <tr>
          {PLAYER_COLS.map((col, ci) => {
            const active = sortKey === col.key;
            const gi = PLAYER_COL_GROUP(ci);
            const g = PLAYER_GROUP_SPANS[gi];
            const isFirst = PLAYER_GROUP_FIRST.has(ci);
            const isSticky = ci === 0 || ci === 1;
            const stickyLeft = ci === 0 ? 0 : rankColW;
            return (
              <th
                key={col.key}
                className={`sp-th sortable${active ? ' active' : ''}${
                  isSticky ? ' sticky-col' : ''
                }`}
                style={{
                  background: active ? 'rgba(255,180,0,0.18)' : g.bg,
                  textAlign: col.align,
                  borderLeft: isFirst && ci > 0 ? g.border : 'none',
                  ...(isSticky
                    ? { position: 'sticky', left: stickyLeft, zIndex: 11 }
                    : {}),
                }}
                onClick={() => col.key !== 'rank' && onSort(col.key)}
                title={col.tip}
              >
                {col.key === 'best_goals' ||
                col.key === 'best_assists' ||
                col.key === 'best_points' ? (
                  <>
                    <span className="col-emoji">🔺</span>
                    {col.label.replace('🔺', '')}
                  </>
                ) : (
                  col.label
                )}
                {col.key !== 'rank' && (
                  <span className="sort-icon">
                    {active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ' ⇅'}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={row.name}
            className={`sp-row ${idx % 2 === 0 ? 'sp-even' : 'sp-odd'}`}
          >
            {PLAYER_COLS.map((col, ci) => {
              const raw = col.key === 'rank' ? idx + 1 : row[col.key];
              const num = Number(raw);
              const gi = PLAYER_COL_GROUP(ci);
              const g = PLAYER_GROUP_SPANS[gi];
              const isFirst = PLAYER_GROUP_FIRST.has(ci);
              const isSticky = ci === 0 || ci === 1;
              const stickyLeft = ci === 0 ? 0 : rankColW;
              const isSorted = sortKey === col.key;
              const mx = maxVals[col.key] || 1;

              let heatBg = isSticky
                ? idx % 2 === 0
                  ? '#07071e'
                  : '#050510'
                : g.bg;
              if (
                !isSticky &&
                isFinite(num) &&
                !['rank', 'name', 'team'].includes(col.key)
              ) {
                const pct = Math.min(num / mx, 1);
                if (pct > 0.7)
                  heatBg = `rgba(255,210,0,${((pct - 0.7) * 0.65).toFixed(3)})`;
              }

              return (
                <td
                  key={col.key}
                  className={`sp-td${isSorted ? ' sorted' : ''}${
                    isSticky ? ' sticky-col sticky-td' : ''
                  }`}
                  style={{
                    textAlign: col.align,
                    background: heatBg,
                    borderLeft: isFirst && ci > 0 ? g.border : 'none',
                    ...(isSticky
                      ? { position: 'sticky', left: stickyLeft, zIndex: 2 }
                      : {}),
                  }}
                >
                  {col.key === 'rank' ? (
                    <span className="td-rank">{raw}</span>
                  ) : col.key === 'name' ? (
                    <span className="td-playername">{raw}</span>
                  ) : col.key === 'team' ? (
                    <div className="td-player-team">
                      <TeamLogo code={raw} />
                    </div>
                  ) : col.key === 'ptspg' ||
                    col.key === 'gpg_rate' ||
                    col.key === 'apg' ? (
                    <span className="td-val">{Number(raw).toFixed(2)}</span>
                  ) : col.key === 'gwg' ? (
                    <span className="td-val">{raw ?? '–'}</span>
                  ) : (
                    <span className="td-val">{raw ?? '–'}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Shared table renderer ────────────────────────────────────────────────
function StatsTable({
  cols,
  rows,
  sortKey,
  sortDir,
  onSort,
  isAllSeasons,
  mgrMeta,
  isH2H,
  isTeam,
  hasStickyCols,
}) {
  const groupSpans = useMemo(() => {
    const out = [];
    let cur = null,
      span = 0;
    for (const c of cols) {
      if (c.group !== cur) {
        if (cur !== null) out.push({ group: cur, span });
        cur = c.group;
        span = 1;
      } else span++;
    }
    if (cur !== null) out.push({ group: cur, span });
    return out;
  }, [cols]);

  const isFirstInGroup = useMemo(() => {
    const s = new Set();
    let prev = null;
    for (const c of cols) {
      if (c.group !== prev) {
        s.add(c.key + '-' + c.group);
        prev = c.group;
      }
    }
    return s;
  }, [cols]);

  const maxVals = useMemo(() => {
    const mv = {};
    for (const c of cols) {
      if (!['rank', 'mgr', 'opp', 'team', 'champs', 'streak'].includes(c.key)) {
        const vals = rows.map((r) => Number(r[c.key] || 0)).filter(isFinite);
        mv[c.key + '-' + c.group] = vals.length ? Math.max(...vals) : 1;
      }
    }
    return mv;
  }, [rows, cols]);

  // Sticky col indices: rank (0) and name col (1)
  // We use a ref on the table and measure actual th widths after render
  const tableRef = useRef(null);
  const [stickyLeftPx, setStickyLeftPx] = useState([0, 0]);
  useEffect(() => {
    if (!hasStickyCols || !tableRef.current) return;
    const ths = tableRef.current.querySelectorAll('thead tr:last-child th');
    if (ths.length >= 2) {
      const w0 = ths[0].getBoundingClientRect().width;
      setStickyLeftPx((prev) => (prev[1] === w0 ? prev : [0, w0]));
    }
  }, [hasStickyCols, rows, cols]);

  const stickyLeft = useMemo(() => {
    if (!hasStickyCols) return new Map();
    const m = new Map();
    m.set(0, stickyLeftPx[0]);
    m.set(1, stickyLeftPx[1]);
    return m;
  }, [hasStickyCols, stickyLeftPx]);

  return (
    <table ref={tableRef} className="sp-table">
      <thead>
        <tr>
          {groupSpans.map(({ group, span }, i) => {
            const g = GROUPS[group] || {};
            const isCore = group === 'core';
            return (
              <th
                key={i}
                colSpan={span}
                className={`sp-gh${
                  isCore && hasStickyCols ? ' sticky-gh' : ''
                }`}
                style={{
                  background: g.groupBg,
                  color: g.groupText,
                  borderLeft: i > 0 ? g.borderLeft : 'none',
                  ...(isCore && hasStickyCols
                    ? { position: 'sticky', left: 0, zIndex: 12 }
                    : {}),
                }}
              >
                {g.label}
              </th>
            );
          })}
        </tr>
        <tr>
          {cols.map((col, ci) => {
            const g = GROUPS[col.group] || {};
            const active = sortKey === col.key;
            const uniqKey = col.key + '-' + col.group;
            const first = isFirstInGroup.has(uniqKey);
            const isSticky = hasStickyCols && (ci === 0 || ci === 1);
            const sLeft = isSticky ? stickyLeft.get(ci) : undefined;
            return (
              <th
                key={uniqKey}
                className={`sp-th${col.sortable ? ' sortable' : ''}${
                  active ? ' active' : ''
                }${isSticky ? ' sticky-col' : ''}`}
                style={{
                  background: active ? 'rgba(255,180,0,0.18)' : g.headerBg,
                  textAlign: col.align,
                  borderLeft:
                    first && col.group !== 'core' ? g.borderLeft : 'none',
                  ...(isSticky
                    ? { position: 'sticky', left: sLeft, zIndex: 11 }
                    : {}),
                }}
                onClick={() => col.sortable && onSort(col.key)}
                title={col.tip}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">
                    {active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ' ⇅'}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const nameKey = isH2H ? row.oppNorm : isTeam ? row.team : row.normKey;
          const meta = isTeam ? null : mgrMeta.get(nameKey);
          const displayName = isH2H
            ? meta?.displayName || row.oppDisplay || row.oppNorm
            : isTeam
            ? row.team
            : meta?.displayName || row._displayName || row.normKey;
          const discordName = meta?.discordName || null;
          const discordIsSame =
            discordName && norm(discordName) === norm(displayName);

          return (
            <tr
              key={isH2H ? row.oppNorm : isTeam ? row.team : row.mgr}
              className={`sp-row ${idx % 2 === 0 ? 'sp-even' : 'sp-odd'}`}
            >
              {cols.map((col, ci) => {
                const uniqKey = col.key + '-' + col.group;
                const raw = col.key === 'rank' ? idx + 1 : row[col.key];
                const num = Number(raw);
                const g = GROUPS[col.group] || {};
                const mx = maxVals[uniqKey] || 1;
                const first = isFirstInGroup.has(uniqKey);
                const isSorted = sortKey === col.key;
                const isSticky = hasStickyCols && (ci === 0 || ci === 1);
                const sLeft = isSticky ? stickyLeft.get(ci) : undefined;

                const lossKeys = isTeam ? TEAM_LOSS_KEYS : LOSS_KEYS;

                let heatBg = isSticky
                  ? idx % 2 === 0
                    ? '#07071e'
                    : '#050510'
                  : g.cellBg;
                if (
                  !isSticky &&
                  isFinite(num) &&
                  !['rank', 'mgr', 'opp', 'team', 'champs', 'streak'].includes(
                    col.key
                  )
                ) {
                  const pct = Math.min(Math.abs(num) / mx, 1);
                  if (lossKeys.has(col.key) && num > 0)
                    heatBg = `rgba(255,55,55,${(pct * 0.22).toFixed(3)})`;
                  else if (!lossKeys.has(col.key) && pct > 0.7)
                    heatBg = `rgba(255,210,0,${((pct - 0.7) * 0.65).toFixed(
                      3
                    )})`;
                }

                const nameColKey = isH2H ? 'opp' : isTeam ? 'team' : 'mgr';

                return (
                  <td
                    key={uniqKey}
                    className={`sp-td${isSorted ? ' sorted' : ''}${
                      isSticky ? ' sticky-col sticky-td' : ''
                    }`}
                    style={{
                      textAlign: col.align,
                      background: heatBg,
                      borderLeft:
                        first && col.group !== 'core' ? g.borderLeft : 'none',
                      ...(isSticky
                        ? { position: 'sticky', left: sLeft, zIndex: 2 }
                        : {}),
                    }}
                  >
                    {col.key === nameColKey && isTeam ? (
                      <div className="td-team">
                        <TeamLogo code={row.team} />
                        <span className="td-teamcode">{row.team}</span>
                      </div>
                    ) : col.key === nameColKey && !isTeam ? (
                      <div className="td-mgr">
                        {meta?.avatar_url ? (
                          <img
                            src={meta.avatar_url}
                            alt=""
                            className="td-avatar"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="td-avatar-fb">
                            {displayName
                              .replace(/\s+/g, '')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="td-mgr-names">
                          <span className="td-mgrname">{displayName}</span>
                          {discordName && (
                            <span
                              className="td-discord"
                              style={{ opacity: discordIsSame ? 0.3 : 0.85 }}
                            >
                              @{discordName}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : col.key === 'rank' ? (
                      <span className="td-rank">{raw}</span>
                    ) : col.key === 'streak' ? (
                      <span
                        className="td-val"
                        style={{
                          color: streakColor(raw),
                          textShadow: streakColor(raw)
                            ? `0 0 8px ${streakColor(raw)}44`
                            : undefined,
                          fontWeight: 'bold',
                        }}
                      >
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key === 'longW' ? (
                      <span
                        className="td-val"
                        style={{
                          color: Number(raw) > 0 ? '#00DD55' : undefined,
                          textShadow:
                            Number(raw) > 0
                              ? '0 0 8px rgba(0,221,85,.4)'
                              : undefined,
                        }}
                      >
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key === 'longL' ? (
                      <span
                        className="td-val"
                        style={{
                          color: Number(raw) > 0 ? '#FF5555' : undefined,
                          textShadow:
                            Number(raw) > 0
                              ? '0 0 8px rgba(255,85,85,.3)'
                              : undefined,
                        }}
                      >
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key === 'champs' ? (
                      <span className={`td-val${raw ? ' td-champ' : ''}`}>
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key === 'pct' ? (
                      <span className={`td-val${num >= 0.65 ? ' great' : ''}`}>
                        {fmtVal(raw, col.key)}
                      </span>
                    ) : col.key === 'diff' || col.key === 'shot_diff' ? (
                      <span
                        className={`td-val${
                          num > 0 ? ' pos' : num < 0 ? ' neg' : ''
                        }`}
                      >
                        {fmtVal(raw, col.key)}
                      </span>
                    ) : (
                      <span className="td-val">{fmtVal(raw, col.key)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function Stats() {
  const { selectedLeague } = useLeague();

  const [tab, setTab] = useState('managers');
  const [allSeasons, setAllSeasons] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [allGames, setAllGames] = useState([]);
  const [managers, setManagers] = useState([]);
  const [champData, setChampData] = useState({
    allSeasonsMap: new Map(),
    perSeasonMap: new Map(),
  });
  const [loading, setLoading] = useState(true);
  const [modeValues, setModeValues] = useState([]);

  // H2H state
  const [h2hMgrA, setH2hMgrA] = useState('');
  const [h2hMgrB, setH2hMgrB] = useState('ALL');

  // Team stats state
  const [teamStatsData, setTeamStatsData] = useState([]);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [teamSeasonFilter, setTeamSeasonFilter] = useState(''); // default to most recent

  // Player stats state
  const [playerStatsData, setPlayerStatsData] = useState([]);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerSeasonFilter, setPlayerSeasonFilter] = useState('');
  const [playerSeasonFrom, setPlayerSeasonFrom] = useState('');
  const [playerSort, dispatchPlayerSort] = useState({
    key: 'pts',
    dir: 'desc',
  });
  const playerSortKey = playerSort.key;
  const playerSortDir = playerSort.dir;

  const [sort, dispatchSort] = useState({ key: 'pct', dir: 'desc' });
  const [h2hSort, dispatchH2hSort] = useState({ key: 'pct', dir: 'desc' });
  const [teamSort, dispatchTeamSort] = useState({ key: 'gf', dir: 'desc' });

  const sortKey = sort.key;
  const sortDir = sort.dir;
  const h2hSortKey = h2hSort.key;
  const h2hSortDir = h2hSort.dir;
  const teamSortKey = teamSort.key;
  const teamSortDir = teamSort.dir;

  const mgrMeta = useMemo(() => {
    const m = new Map();
    for (const mgr of managers) {
      if (!mgr.coach_name) continue;
      m.set(norm(mgr.coach_name), {
        displayName: mgr.coach_name,
        discordName: (mgr.discord_username || '').trim() || null,
        avatar_url: mgr.discord_url || null,
      });
    }
    return m;
  }, [managers]);

  // ── Fetch all games (season + playoff) ───────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setAllGames([]);
    setModeValues([]);
    Promise.all([
      supabase
        .from('games')
        .select(
          'id,lg,mode,home,away,coach_home,coach_away,score_home,score_away,ot'
        ),
      supabase
        .from('playoff_games')
        .select(
          'id,lg,round,series_number,game_number,team_code_a,team_code_b,seed_a,seed_b,team_a_score,team_b_score, ot_flag'
        )
        .not('team_a_score', 'is', null),
      supabase
        .from('managers')
        .select('id, coach_name, discord_username, discord_url'),
      supabase
        .from('teams')
        .select('abr,lg,manager_id')
        .not('manager_id', 'is', null)
        .order('lg', { ascending: false }),
    ]).then(([gamesRes, playoffRes, managersRes, teamsRes]) => {
      const seasonRows = gamesRes.data || [];

      // Build manager_id → coach_name lookup
      const mgrIdToName = new Map();
      for (const m of managersRes.data || []) {
        if (m.id && m.coach_name) mgrIdToName.set(m.id, m.coach_name.trim());
      }

      // Build team abr → coach name (most recent season wins due to order desc)
      const teamCoachMap = new Map();
      for (const t of teamsRes.data || []) {
        const abr = t.abr?.trim().toUpperCase();
        if (abr && t.manager_id && !teamCoachMap.has(abr)) {
          const coachName = mgrIdToName.get(t.manager_id);
          if (coachName) teamCoachMap.set(abr, coachName);
        }
      }

      // Determine which seasons have data in playoff_games
      const seasonsInPlayoffTable = new Set(
        (playoffRes.data || []).map((g) => g.lg).filter(Boolean)
      );

      // Normalize playoff rows from playoff_games
      const playoffRows = (playoffRes.data || []).map((g) => ({
        id: g.id,
        lg: g.lg,
        mode: 'playoff',
        home: g.team_code_a,
        away: g.team_code_b,
        coach_home: teamCoachMap.get(g.team_code_a?.trim().toUpperCase()) || '',
        coach_away: teamCoachMap.get(g.team_code_b?.trim().toUpperCase()) || '',
        score_home: g.team_a_score,
        score_away: g.team_b_score,
        ot: g.ot_flag === 1 ? 1 : 0,
        _isPlayoff: true,
        round: g.round,
        series_number: g.series_number,
        game_number: g.game_number,
      }));

      // Strip playoff rows from games table for seasons covered by playoff_games
      const filteredSeasonRows = seasonRows.filter((g) => {
        const isPlayoffMode = PLAYOFF_VALS.has(
          (g.mode || '').trim().toUpperCase()
        );
        if (isPlayoffMode && seasonsInPlayoffTable.has(g.lg)) return false;
        return true;
      });

      const allRows = [...filteredSeasonRows, ...playoffRows];
      setAllGames(allRows);
      setManagers(managersRes.data || []);
      setModeValues([
        ...new Set(seasonRows.map((g) => g.mode).filter(Boolean)),
      ]);
      setLoading(false);
    });
  }, []);

  const leagueGames = useMemo(() => {
    if (!selectedLeague || !allGames.length) return [];
    return allGames.filter((g) => g.lg && lgPrefix(g.lg) === selectedLeague);
  }, [allGames, selectedLeague]);

  useEffect(() => {
    setSeasonFilter('ALL');
    if (!leagueGames.length) {
      setAllSeasons([]);
      return;
    }
    const codes = [...new Set(leagueGames.map((g) => g.lg).filter(Boolean))];
    codes.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0,
        nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return nb - na;
    });
    setAllSeasons(codes);
  }, [leagueGames]);

  // ── Default teamSeasonFilter to most recent season ───────────────────────
  useEffect(() => {
    if (allSeasons.length > 0 && !teamSeasonFilter) {
      setTeamSeasonFilter(allSeasons[0]);
    }
    if (allSeasons.length > 0 && !playerSeasonFilter) {
      setPlayerSeasonFilter(allSeasons[0]);
      setPlayerSeasonFrom(allSeasons[0]);
    }
  }, [allSeasons]);

  // ── Championships ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!allSeasons.length) return;
    supabase
      .from('seasons')
      .select('lg, season_champion_manager_id')
      .in('lg', allSeasons)
      .not('season_champion_manager_id', 'is', null)
      .then(({ data: sd, error }) => {
        if (error) {
          console.warn('[Stats] seasons champ error:', error.message);
          return;
        }
        const idToNorm = new Map();
        for (const mgr of managers) {
          if (mgr.id && mgr.coach_name)
            idToNorm.set(mgr.id, norm(mgr.coach_name));
        }
        const allMap = new Map(),
          perMap = new Map();
        for (const s of sd || []) {
          const ck = idToNorm.get(s.season_champion_manager_id);
          if (!ck) continue;
          allMap.set(ck, (allMap.get(ck) || 0) + 1);
          if (!perMap.has(s.lg)) perMap.set(s.lg, new Map());
          perMap.get(s.lg).set(ck, true);
        }
        setChampData({ allSeasonsMap: allMap, perSeasonMap: perMap });
      });
  }, [allSeasons, managers]);

  const isAllSeasons = seasonFilter === 'ALL';
  const champMap = useMemo(() => {
    if (isAllSeasons) return champData.allSeasonsMap;
    return champData.perSeasonMap.get(seasonFilter) || new Map();
  }, [champData, seasonFilter, isAllSeasons]);

  // ── Filtered games ───────────────────────────────────────────────────────
  const filteredGames = useMemo(() => {
    if (!leagueGames.length) return [];
    let r = isAllSeasons
      ? leagueGames
      : leagueGames.filter((g) => g.lg === seasonFilter);
    if (modeFilter === 'SEASON')
      r = r.filter((g) => SEASON_VALS.has((g.mode || '').trim().toUpperCase()));
    if (modeFilter === 'PLAYOFFS')
      r = r.filter((g) =>
        PLAYOFF_VALS.has((g.mode || '').trim().toUpperCase())
      );
    return r;
  }, [leagueGames, seasonFilter, isAllSeasons, modeFilter]);

  // ── Fetch team stats from game_stats_team ────────────────────────────────
  useEffect(() => {
    if (tab !== 'teams' || !teamSeasonFilter || !selectedLeague) return;
    setTeamStatsLoading(true);
    setTeamStatsData([]);

    // season field in game_stats_team is like "W16" — match the season code directly
    // We fetch by season value, case-insensitive handled by ilike
    supabase
      .from('game_stats_team')
      .select('*')
      .ilike('season', teamSeasonFilter)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Stats] game_stats_team error:', error.message);
          setTeamStatsLoading(false);
          return;
        }

        let rows = data || [];
        if (modeFilter === 'SEASON') {
          rows = rows.filter(
            (g) =>
              SEASON_VALS.has((g.type || '').trim().toUpperCase()) &&
              g.playoff_game_id == null
          );
        } else if (modeFilter === 'PLAYOFFS') {
          rows = rows.filter((g) => g.playoff_game_id != null);
        } else {
          // ALL — exclude rows that have a game_id AND a playoff type to avoid doubles
          // Keep: season rows (game_id set, not playoff type) + new playoff rows (playoff_game_id set)
          // Drop: old playoff rows that were inserted into games table before playoff_games existed
          rows = rows.filter((g) => {
            const isPlayoffType = PLAYOFF_VALS.has(
              (g.type || '').trim().toUpperCase()
            );
            if (isPlayoffType && g.playoff_game_id == null) return false; // old duplicate
            return true;
          });
        }
        // ALL — include everything

        setTeamStatsData(rows);
        setTeamStatsLoading(false);
      });
  }, [tab, teamSeasonFilter, selectedLeague, modeFilter]);

  // ── Fetch player stats from game_raw_scoring ─────────────────────────────
  useEffect(() => {
    if (tab !== 'players' || !playerSeasonFilter || !selectedLeague) return;
    // Build list of seasons in range
    const fromIdx = allSeasons.indexOf(playerSeasonFrom || playerSeasonFilter);
    const toIdx = allSeasons.indexOf(playerSeasonFilter);
    // allSeasons is sorted newest→oldest so from is higher index
    const startIdx = Math.min(fromIdx, toIdx);
    const endIdx = Math.max(fromIdx, toIdx);
    const seasonsInRange = allSeasons.slice(startIdx, endIdx + 1);
    setPlayerStatsLoading(true);
    setPlayerStatsData([]);

    Promise.all([
      supabase
        .from('game_raw_scoring')
        .select(
          'goal_player_name, assist_primary_name, assist_secondary_name, g_team, score_type, period, goal_num, game_id, playoff_game_id, season, mode'
        )
        .in('season', seasonsInRange),
      supabase
        .from('games')
        .select('id, home, away, score_home, score_away, lg')
        .in('lg', seasonsInRange)
        .not('score_home', 'is', null),
      supabase
        .from('playoff_games')
        .select('id, team_code_a, team_code_b, team_a_score, team_b_score, lg')
        .in('lg', seasonsInRange)
        .not('team_a_score', 'is', null),
    ]).then(([scoringRes, gamesRes, playoffGamesRes]) => {
      if (scoringRes.error) {
        console.error(
          '[Stats] game_raw_scoring error:',
          scoringRes.error.message
        );
        setPlayerStatsLoading(false);
        return;
      }

      // Build game score lookups for GWG calculation
      const gameScores = new Map();
      for (const g of gamesRes.data || []) {
        gameScores.set(`s-${g.id}`, {
          home: g.home,
          away: g.away,
          score_home: g.score_home,
          score_away: g.score_away,
        });
      }
      for (const g of playoffGamesRes.data || []) {
        gameScores.set(`po-${g.id}`, {
          home: g.team_code_a,
          away: g.team_code_b,
          score_home: g.team_a_score,
          score_away: g.team_b_score,
        });
      }

      // Annotate GWG: group goals by game, find winning team's winning goal
      // The GWG is the goal that gives the winning team their final winning margin
      // e.g. if home wins 4-2, the GWG is home team's 3rd goal (the one that made it 3-2)
      const goalsByGame = new Map();
      for (const r of scoringRes.data || []) {
        const gameKey = r.playoff_game_id
          ? `po-${r.playoff_game_id}`
          : `s-${r.game_id}`;
        if (!goalsByGame.has(gameKey)) goalsByGame.set(gameKey, []);
        goalsByGame.get(gameKey).push(r);
      }

      // Mark GWG on each row
      const annotated = (scoringRes.data || []).map((r) => ({
        ...r,
        _isGWG: false,
      }));
      const rowByKey = new Map();
      for (const r of annotated) {
        const gameKey = r.playoff_game_id
          ? `po-${r.playoff_game_id}`
          : `s-${r.game_id}`;
        if (!rowByKey.has(gameKey)) rowByKey.set(gameKey, []);
        rowByKey.get(gameKey).push(r);
      }

      for (const [gameKey, goals] of rowByKey.entries()) {
        const game = gameScores.get(gameKey);
        if (!game) continue;
        const { home, score_home, score_away } = game;
        const winnerScore = Math.max(score_home, score_away);
        const loserScore = Math.min(score_home, score_away);
        if (winnerScore === loserScore) continue; // tie
        const winningTeam = score_home > score_away ? home : game.away;
        const gwgGoalNum = loserScore + 1; // the goal that put winner ahead for good

        // Sort goals by goal_num to find the right one
        const sorted = [...goals].sort(
          (a, b) => (a.goal_num || 0) - (b.goal_num || 0)
        );
        let winnerGoalCount = 0;
        for (const g of sorted) {
          if (
            (g.g_team || '').toUpperCase() === (winningTeam || '').toUpperCase()
          ) {
            winnerGoalCount++;
            if (winnerGoalCount === gwgGoalNum) {
              g._isGWG = true;
              break;
            }
          }
        }
      }

      let rows = annotated;
      if (modeFilter === 'SEASON') {
        rows = rows.filter(
          (r) =>
            r.playoff_game_id == null &&
            SEASON_VALS.has((r.mode || '').trim().toUpperCase())
        );
      } else if (modeFilter === 'PLAYOFFS') {
        rows = rows.filter((r) => r.playoff_game_id != null);
      }
      setPlayerStatsData(rows);
      setPlayerStatsLoading(false);
    });
  }, [tab, playerSeasonFilter, playerSeasonFrom, selectedLeague, modeFilter]);

  // ── Sort handlers ────────────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    if (!key || key === 'rank') return;
    dispatchSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: ASC_DEFAULT.has(key) ? 'asc' : 'desc' }
    );
  }, []);

  const handleH2hSort = useCallback((key) => {
    if (!key || key === 'rank') return;
    dispatchH2hSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: ASC_DEFAULT.has(key) ? 'asc' : 'desc' }
    );
  }, []);

  /****** Team Sort  ******/
  const handleTeamSort = useCallback((key) => {
    if (!key || key === 'rank') return;
    dispatchTeamSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: TEAM_LOSS_KEYS.has(key) ? 'asc' : 'desc' }
    );
  }, []);

  /****** Player Sort  ******/
  const handlePlayerSort = useCallback((key) => {
    if (!key || key === 'rank') return;
    dispatchPlayerSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  }, []);

  useEffect(() => {
    dispatchSort({ key: 'pct', dir: 'desc' });
  }, [tab]);
  useEffect(() => {
    dispatchH2hSort({ key: 'pct', dir: 'desc' });
  }, [tab]);
  useEffect(() => {
    dispatchTeamSort({ key: 'gf', dir: 'desc' });
  }, [tab]);
  useEffect(() => {
    dispatchPlayerSort({ key: 'pts', dir: 'desc' });
  }, [tab]);

  // ── Manager list for H2H dropdowns ──────────────────────────────────────
  const h2hManagerList = useMemo(() => {
    const coaches = new Set();
    for (const g of filteredGames) {
      if (g.coach_home) coaches.add(g.coach_home.trim());
      if (g.coach_away) coaches.add(g.coach_away.trim());
    }
    return [...coaches].sort((a, b) => a.localeCompare(b));
  }, [filteredGames]);

  useEffect(() => {
    if (h2hMgrA && !h2hManagerList.map(norm).includes(norm(h2hMgrA))) {
      setH2hMgrA('');
    }
  }, [h2hManagerList, h2hMgrA]);

  // ── Manager rows ─────────────────────────────────────────────────────────
  const managerRows = useMemo(() => {
    if (!filteredGames.length) return [];
    return buildManagerStats(filteredGames, champMap);
  }, [filteredGames, champMap]);

  const sortedManagerRows = useMemo(() => {
    return [...managerRows].sort((a, b) => {
      let av = a[sortKey],
        bv = b[sortKey];
      if (sortKey === 'champs') {
        av = av == null ? -1 : av === true ? 1 : Number(av);
        bv = bv == null ? -1 : bv === true ? 1 : Number(bv);
      }
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv || '').toLowerCase();
      }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (sortDir === 'desc' ? -1 : 1);
    });
  }, [managerRows, sortKey, sortDir]);

  // ── H2H rows ──────────────────────────────────────────────────────────────
  const h2hRows = useMemo(() => {
    if (!h2hMgrA || !filteredGames.length) return [];
    const mgrANorm = norm(h2hMgrA);
    const mgrBNorm = h2hMgrB === 'ALL' ? 'ALL' : norm(h2hMgrB);
    return buildH2HStats(filteredGames, mgrANorm, mgrBNorm);
  }, [filteredGames, h2hMgrA, h2hMgrB]);

  const sortedH2hRows = useMemo(() => {
    return [...h2hRows].sort((a, b) => {
      let av = h2hSortKey === 'streak' ? a._streakVal : a[h2hSortKey];
      let bv = h2hSortKey === 'streak' ? b._streakVal : b[h2hSortKey];
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv || '').toLowerCase();
      }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (h2hSortDir === 'desc' ? -1 : 1);
    });
  }, [h2hRows, h2hSortKey, h2hSortDir]);

  // ── Team rows ─────────────────────────────────────────────────────────────
  const teamRows = useMemo(() => {
    if (!teamStatsData.length) return [];
    return buildTeamStats(teamStatsData);
  }, [teamStatsData]);

  const sortedTeamRows = useMemo(() => {
    return [...teamRows].sort((a, b) => {
      let av = a[teamSortKey],
        bv = b[teamSortKey];
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv || '').toLowerCase();
      }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (teamSortDir === 'desc' ? -1 : 1);
    });
  }, [teamRows, teamSortKey, teamSortDir]);

  // ── Player rows ──────────────────────────────────────────────────────────
  const playerRows = useMemo(() => {
    if (!playerStatsData.length) return [];
    return buildPlayerStats(playerStatsData);
  }, [playerStatsData]);

  const sortedPlayerRows = useMemo(() => {
    return [...playerRows].sort((a, b) => {
      let av = a[playerSortKey],
        bv = b[playerSortKey];
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv || '').toLowerCase();
      }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (playerSortDir === 'desc' ? -1 : 1);
    });
  }, [playerRows, playerSortKey, playerSortDir]);

  const hasModeData = modeValues.length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="sp">
      <div className="scanlines" aria-hidden />
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">STATS</div>
        </div>
      </div>
      {/* ── Tabs ── */}
      <div className="sp-tabs">
        <div
          style={{
            display: 'flex',
            gap: '.5rem',
            alignItems: 'flex-end',
            flex: 1,
          }}
        >
          <button
            className={`sp-tab ${tab === 'managers' ? 'on' : ''}`}
            onClick={() => setTab('managers')}
          >
            👔 MANAGERS
          </button>
          <button
            className={`sp-tab ${tab === 'h2h' ? 'on' : ''}`}
            onClick={() => setTab('h2h')}
          >
            ⚔️ H2H
          </button>
          <button
            className={`sp-tab ${tab === 'teams' ? 'on' : ''}`}
            onClick={() => setTab('teams')}
          >
            🏒 TEAMS
          </button>
          <button
            className={`sp-tab ${tab === 'players' ? 'on' : ''}`}
            onClick={() => setTab('players')}
          >
            👤 PLAYERS
          </button>
        </div>
        {((tab === 'managers' && sortedManagerRows.length > 0) ||
          (tab === 'h2h' && sortedH2hRows.length > 0) ||
          (tab === 'teams' && sortedTeamRows.length > 0)) && (
          <div className="sp-legend-inline">
            <div className="leg-item">
              <span
                className="leg-sw"
                style={{
                  background: 'rgba(255,210,0,.38)',
                  border: '1px solid rgba(255,215,0,.6)',
                }}
              />
              BEST
            </div>
            <div className="leg-item">
              <span
                className="leg-sw"
                style={{
                  background: 'rgba(255,55,55,.32)',
                  border: '1px solid rgba(255,80,80,.5)',
                }}
              />
              WORST
            </div>
          </div>
        )}
        <div className="sp-tabs-line" />
      </div>
      {/* ── Filters ── */}
      <div className="sp-filters">
        <div className="sp-filters-inner">
          <div className="sf-group">
            <span className="sf-lbl">MODE</span>
            <div className="sf-btns">
              {['ALL', 'SEASON', 'PLAYOFFS'].map((mo) => (
                <button
                  key={mo}
                  className={`sf-btn ${
                    (tab === 'teams' ? modeFilter : modeFilter) === mo
                      ? 'sf-on'
                      : ''
                  }${!hasModeData && mo !== 'ALL' ? ' sf-dim' : ''}`}
                  onClick={() => setModeFilter(mo)}
                >
                  {mo}
                </button>
              ))}
            </div>
          </div>

          {/* Season filter — hidden for Teams tab (Teams uses its own selector) */}
          {tab !== 'teams' && (
            <div className="sf-group">
              <span className="sf-lbl">SEASON</span>
              <div className="sf-sel-wrap">
                <select
                  className="sf-sel"
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                >
                  <option value="ALL">ALL SEASONS</option>
                  {allSeasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="sf-caret">▾</span>
              </div>
            </div>
          )}

          {/* Players tab season selector */}
          {tab === 'players' && (
            <>
              <div className="sf-group">
                <span className="sf-lbl">FROM</span>
                <div className="sf-sel-wrap">
                  <select
                    className="sf-sel"
                    value={playerSeasonFrom}
                    onChange={(e) => setPlayerSeasonFrom(e.target.value)}
                  >
                    {allSeasons.length === 0 && (
                      <option value="">— NO SEASONS —</option>
                    )}
                    {allSeasons.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="sf-caret">▾</span>
                </div>
              </div>
              <span
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 10,
                  color: 'rgba(255,255,255,.25)',
                  letterSpacing: 2,
                }}
              >
                →
              </span>
              <div className="sf-group">
                <span className="sf-lbl">TO</span>
                <div className="sf-sel-wrap">
                  <select
                    className="sf-sel"
                    value={playerSeasonFilter}
                    onChange={(e) => setPlayerSeasonFilter(e.target.value)}
                  >
                    {allSeasons.length === 0 && (
                      <option value="">— NO SEASONS —</option>
                    )}
                    {allSeasons.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="sf-caret">▾</span>
                </div>
              </div>
            </>
          )}

          {/* Team tab season selector */}
          {tab === 'teams' && (
            <div className="sf-group">
              <span className="sf-lbl">SEASON</span>
              <div className="sf-sel-wrap">
                <select
                  className="sf-sel"
                  value={teamSeasonFilter}
                  onChange={(e) => setTeamSeasonFilter(e.target.value)}
                >
                  {allSeasons.length === 0 && (
                    <option value="">— NO SEASONS —</option>
                  )}
                  {allSeasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="sf-caret">▾</span>
              </div>
            </div>
          )}

          {tab === 'managers' && !loading && sortedManagerRows.length > 0 && (
            <div className="sf-count">
              {filteredGames.length.toLocaleString()} GAMES ·{' '}
              {sortedManagerRows.length} COACHES
            </div>
          )}
          {tab === 'h2h' && h2hMgrA && sortedH2hRows.length > 0 && (
            <div className="sf-count">
              {sortedH2hRows.reduce((s, r) => s + r.gp, 0)} GAMES ·{' '}
              {sortedH2hRows.length} OPPONENTS
            </div>
          )}
          {tab === 'teams' && sortedTeamRows.length > 0 && (
            <div className="sf-count">
              {teamStatsData.length.toLocaleString()} GAMES ·{' '}
              {sortedTeamRows.length} TEAMS
            </div>
          )}
          {tab === 'players' && sortedPlayerRows.length > 0 && (
            <div className="sf-count">
              {playerStatsData.length.toLocaleString()} PLAYS ·{' '}
              {sortedPlayerRows.length} PLAYERS
            </div>
          )}
        </div>
      </div>
      {/* ── H2H dropdowns ── */}
      {tab === 'h2h' && (
        <div className="h2h-selectors">
          <div className="h2h-sel-group">
            <span className="sf-lbl">MANAGER A</span>
            <div className="sf-sel-wrap">
              <select
                className="sf-sel h2h-sel"
                value={h2hMgrA}
                onChange={(e) => {
                  setH2hMgrA(e.target.value);
                  setH2hMgrB('ALL');
                }}
              >
                <option value="">— SELECT MANAGER —</option>
                {h2hManagerList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="sf-caret">▾</span>
            </div>
          </div>
          <div className="h2h-vs">VS</div>
          <div className="h2h-sel-group">
            <span className="sf-lbl">MANAGER B</span>
            <div className="sf-sel-wrap">
              <select
                className="sf-sel h2h-sel"
                value={h2hMgrB}
                onChange={(e) => setH2hMgrB(e.target.value)}
                disabled={!h2hMgrA}
              >
                <option value="ALL">ALL OPPONENTS</option>
                {h2hManagerList
                  .filter((m) => norm(m) !== norm(h2hMgrA))
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
              </select>
              <span className="sf-caret">▾</span>
            </div>
          </div>
          {h2hMgrA && (
            <div className="h2h-headline">
              <span className="h2h-name-a">{h2hMgrA}</span>
              <span className="h2h-vs-txt">vs</span>
              <span className="h2h-name-b">
                {h2hMgrB === 'ALL' ? 'ALL OPPONENTS' : h2hMgrB}
              </span>
              {sortedH2hRows.length > 0 && (
                <span className="h2h-record">
                  {sortedH2hRows.reduce((s, r) => s + r.w, 0)}W–
                  {sortedH2hRows.reduce((s, r) => s + r.l, 0)}L–
                  {sortedH2hRows.reduce((s, r) => s + r.t, 0)}T
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {/* ── Content ── */}
      {tab === 'players' ? (
        <div className="sp-table-outer">
          {playerStatsLoading ? (
            <div className="sp-state">
              <div className="sp-spinner" />
              <span className="sp-state-txt">CRUNCHING NUMBERS…</span>
            </div>
          ) : !playerSeasonFilter ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>👤</span>
              <span className="sp-state-txt">SELECT A SEASON</span>
            </div>
          ) : sortedPlayerRows.length === 0 ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>📊</span>
              <span className="sp-state-txt">NO PLAYER DATA FOUND</span>
              <span className="sp-state-sub">
                No <code>game_raw_scoring</code> records found for season{' '}
                <strong>{playerSeasonFilter}</strong>
                {modeFilter !== 'ALL' ? ` (mode: ${modeFilter})` : ''}.
              </span>
            </div>
          ) : (
            <PlayerStatsTable
              rows={sortedPlayerRows}
              sortKey={playerSortKey}
              sortDir={playerSortDir}
              onSort={handlePlayerSort}
            />
          )}
        </div>
      ) : tab === 'teams' ? (
        <div className="sp-table-outer">
          {teamStatsLoading ? (
            <div className="sp-state">
              <div className="sp-spinner" />
              <span className="sp-state-txt">CRUNCHING NUMBERS…</span>
            </div>
          ) : !teamSeasonFilter ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>🏒</span>
              <span className="sp-state-txt">SELECT A SEASON</span>
              <span className="sp-state-sub">
                Team stats are displayed per season. Choose a season above to
                load team data.
              </span>
            </div>
          ) : sortedTeamRows.length === 0 ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>📊</span>
              <span className="sp-state-txt">NO TEAM DATA FOUND</span>
              <span className="sp-state-sub">
                No <code>game_stats_team</code> records found for season{' '}
                <strong>{teamSeasonFilter}</strong>
                {modeFilter !== 'ALL' ? ` (mode: ${modeFilter})` : ''}.
              </span>
            </div>
          ) : (
            <StatsTable
              cols={TEAM_COLS_DEDUPED}
              rows={sortedTeamRows}
              sortKey={teamSortKey}
              sortDir={teamSortDir}
              onSort={handleTeamSort}
              isAllSeasons={false}
              mgrMeta={new Map()}
              isH2H={false}
              isTeam={true}
              hasStickyCols={true}
            />
          )}
        </div>
      ) : tab === 'h2h' ? (
        <div className="sp-table-outer">
          {loading ? (
            <div className="sp-state">
              <div className="sp-spinner" />
              <span className="sp-state-txt">CRUNCHING NUMBERS…</span>
            </div>
          ) : !h2hMgrA ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>⚔️</span>
              <span className="sp-state-txt">SELECT A MANAGER</span>
              <span className="sp-state-sub">
                Choose Manager A to see their head-to-head record against all
                opponents.
              </span>
            </div>
          ) : sortedH2hRows.length === 0 ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>📊</span>
              <span className="sp-state-txt">NO H2H DATA FOUND</span>
              <span className="sp-state-sub">
                No games found for this combination of filters.
              </span>
            </div>
          ) : (
            <StatsTable
              cols={H2H_COLS}
              rows={sortedH2hRows}
              sortKey={h2hSortKey}
              sortDir={h2hSortDir}
              onSort={handleH2hSort}
              isAllSeasons={isAllSeasons}
              mgrMeta={mgrMeta}
              isH2H={true}
              isTeam={false}
              hasStickyCols={true}
            />
          )}
        </div>
      ) : (
        <div className="sp-table-outer">
          {loading ? (
            <div className="sp-state">
              <div className="sp-spinner" />
              <span className="sp-state-txt">CRUNCHING NUMBERS…</span>
            </div>
          ) : sortedManagerRows.length === 0 ? (
            <div className="sp-state">
              <span style={{ fontSize: 44, opacity: 0.18 }}>📊</span>
              <span className="sp-state-txt">NO STATS FOUND</span>
              <span className="sp-state-sub">
                {modeFilter !== 'ALL' && !filteredGames.length
                  ? `Mode "${modeFilter}" — no games matched. DB values: ${modeValues.join(
                      ', '
                    )}`
                  : 'Check that game data exists for this league.'}
              </span>
            </div>
          ) : (
            <StatsTable
              cols={MANAGER_COLS}
              rows={sortedManagerRows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              isAllSeasons={isAllSeasons}
              mgrMeta={mgrMeta}
              isH2H={false}
              isTeam={false}
              hasStickyCols={true}
            />
          )}
        </div>
      )}
      {/* ── Legends ── */}
      {tab === 'managers' && sortedManagerRows.length > 0 && (
        <div className="sp-legend-footer">
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: GROUPS.record.groupBg,
                borderLeft: GROUPS.record.borderLeft,
              }}
            />
            RECORD
          </div>
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: GROUPS.goals.groupBg,
                borderLeft: GROUPS.goals.borderLeft,
              }}
            />
            GOALS
          </div>
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: GROUPS.home.groupBg,
                borderLeft: GROUPS.home.borderLeft,
              }}
            />
            HOME
          </div>
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: GROUPS.away.groupBg,
                borderLeft: GROUPS.away.borderLeft,
              }}
            />
            AWAY
          </div>
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: 'rgba(255,210,0,.38)',
                border: '1px solid rgba(255,215,0,.6)',
              }}
            />
            TOP
          </div>
          <div className="leg-item">
            <span
              className="leg-sw"
              style={{
                background: 'rgba(255,55,55,.32)',
                border: '1px solid rgba(255,80,80,.5)',
              }}
            />
            WORST
          </div>
          <span className="leg-note">
            {isAllSeasons
              ? 'All-time champs shown'
              : `${seasonFilter} champion only`}
            {' · '}Click column to sort · click again to reverse
          </span>
        </div>
      )}
      <style>{`
        *,*::before,*::after{box-sizing:border-box;}
        html{overflow-x:auto;}
        body{background:#00000a!important;overflow-x:auto;}
        .sp{min-height:100vh;background:radial-gradient(ellipse 100% 35% at 50% 0%,#0a0a22 0%,transparent 55%),#00000a;padding-bottom:80px;overflow-x:visible;}
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);}

        .scoreboard-header-container{display:flex;justify-content:center;margin-bottom:1rem;}
        .scoreboard-header{background:#000;border:6px solid #333;border-radius:8px;padding:1rem 2rem;box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3);position:relative;overflow:hidden;}
        .scoreboard-header::before{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);}
        .scoreboard-header::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);animation:shimmerHdr 3s infinite;}
        @keyframes shimmerHdr{0%{transform:translateX(-100%) translateY(-100%) rotate(45deg);}100%{transform:translateX(100%) translateY(100%) rotate(45deg);}}
        .led-text{font-family:'Press Start 2P',monospace;font-size:2rem;color:#FFD700;letter-spacing:6px;text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;filter:contrast(1.3) brightness(1.2);position:relative;}

        .sp-tabs{display:flex;align-items:flex-end;gap:.5rem;padding:0 2rem;max-width:1600px;margin:0 auto;position:relative;}
        .sp-tabs-line{position:absolute;bottom:0;left:2rem;right:2rem;height:2px;background:rgba(255,140,0,.2);}
        .sp-tab{font-family:'Press Start 2P',monospace;font-size:14px;letter-spacing:2px;padding:.8rem 1.6rem;background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.1);border-bottom:none;border-radius:10px 10px 0 0;color:rgba(255,255,255,.32);cursor:pointer;transition:all .18s;position:relative;z-index:1;}
        .sp-tab:hover{background:rgba(255,140,0,.07);color:rgba(255,140,0,.7);border-color:rgba(255,140,0,.3);}
        .sp-tab.on{background:rgba(255,140,0,.11);border-color:rgba(255,140,0,.6);color:#FF8C00;text-shadow:0 0 14px rgba(255,140,0,.45);margin-bottom:-2px;padding-bottom:calc(.8rem + 2px);}
        .sp-legend-inline{display:flex;align-items:center;gap:.8rem;padding:.4rem .8rem;margin-bottom:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;position:relative;z-index:1;}

        .sp-filters{background:rgba(0,0,12,.75);border-bottom:1px solid rgba(255,255,255,.06);padding:.9rem 2rem;}
        .sp-filters-inner{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem 1.8rem;max-width:1600px;margin:0 auto;}
        .sf-group{display:flex;align-items:center;gap:.55rem;}
        .sf-lbl{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.3);letter-spacing:2px;white-space:nowrap;}
        .sf-btns{display:flex;gap:.3rem;}
        .sf-btn{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem .9rem;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.38);cursor:pointer;transition:all .14s;letter-spacing:1px;}
        .sf-btn:hover{background:rgba(255,140,0,.09);border-color:rgba(255,140,0,.4);color:rgba(255,140,0,.85);}
        .sf-btn.sf-on{background:rgba(255,140,0,.15);border-color:#FF8C00;color:#FF8C00;text-shadow:0 0 10px rgba(255,140,0,.4);}
        .sf-btn.sf-dim{opacity:.45;}
        .sf-sel-wrap{position:relative;display:inline-flex;align-items:center;}
        .sf-sel{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem 2.2rem .5rem .9rem;background:rgba(0,0,20,.85);border:1.5px solid rgba(255,255,255,.2);border-radius:6px;color:rgba(255,255,255,.78);cursor:pointer;appearance:none;-webkit-appearance:none;letter-spacing:1px;transition:border-color .15s;min-width:155px;}
        .sf-sel:hover,.sf-sel:focus{border-color:rgba(255,140,0,.55);outline:none;color:#FF8C00;}
        .sf-sel option{background:#0a0a18;color:#fff;}
        .sf-caret{position:absolute;right:.6rem;font-size:14px;color:rgba(255,255,255,.4);pointer-events:none;}
        .sf-count{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:1px;margin-left:auto;}

        .h2h-selectors{display:flex;align-items:center;flex-wrap:wrap;gap:1rem 2rem;padding:1rem 2rem;background:rgba(0,0,18,.6);border-bottom:1px solid rgba(255,140,0,.15);max-width:100%;}
        .h2h-sel-group{display:flex;align-items:center;gap:.6rem;}
        .h2h-sel{min-width:200px;font-size:11px!important;}
        .h2h-vs{font-family:'Press Start 2P',monospace;font-size:14px;color:rgba(255,140,0,.6);letter-spacing:3px;padding:0 .5rem;}
        .h2h-headline{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-left:auto;}
        .h2h-name-a{font-family:'Press Start 2P',monospace;font-size:12px;color:#87CEEB;text-shadow:0 0 10px rgba(135,206,235,.5);}
        .h2h-vs-txt{font-family:'VT323',monospace;font-size:20px;color:rgba(255,255,255,.3);}
        .h2h-name-b{font-family:'Press Start 2P',monospace;font-size:12px;color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .h2h-record{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.5);margin-left:.5rem;letter-spacing:1px;}

        /* Table — page scrolls horizontally via html/body overflow-x:auto */
        .sp-table-outer{width:100%;overflow-x:visible;}
        .sp-table{width:max-content;min-width:100%;border-collapse:collapse;}
        /* Group header row */
        .sp-gh{font-family:'Press Start 2P',monospace;font-size:10px;letter-spacing:3px;padding:.5rem .65rem .4rem;text-align:center;border-bottom:2px solid rgba(255,255,255,.1);}
        /* Column header row — sticky top within the page scroll */
        .sp-th{font-family:'Press Start 2P',monospace;font-size:11px;padding:.65rem .65rem;white-space:nowrap;position:sticky;top:0;z-index:10;border-bottom:2px solid rgba(255,255,255,.12);user-select:none;color:rgba(255,255,255,.5);transition:color .12s,background .12s,box-shadow .12s;}
        .sp-th .col-emoji{color:initial;opacity:1;filter:none;font-size:16px;line-height:1;vertical-align:middle;}
        .sp-th .col-emoji{font-size:14px;display:inline-block;vertical-align:middle;margin-right:1px;}
        .sp-th.sortable{cursor:pointer;}
        .sp-th.sortable:hover{color:#FF8C00!important;}
        .sp-th.active{color:#FFD700!important;box-shadow:inset 0 -3px 0 rgba(255,215,0,.7);}
        .sort-icon{opacity:.5;font-size:10px;}
        .sp-th.active .sort-icon{opacity:1;}
        /* Sticky left cols — rank and team for team tab */
        .sticky-col{box-shadow:3px 0 0 0 #07071a;}
        .sticky-td{background:#07071e;}
        .sp-th.sticky-col{z-index:13!important;background:#07071a!important;box-shadow:3px 0 0 0 #07071a;}
        .sp-gh.sticky-gh{z-index:13!important;background:#07071a!important;box-shadow:3px 0 0 0 #07071a;}
        .sp-even .sticky-td{background:#07071e!important;}
        .sp-odd  .sticky-td{background:#050510!important;}
        .sp-row:hover .sticky-td{background:rgba(40,20,0,.97)!important;box-shadow:3px 0 0 0 rgba(40,20,0,.97);}
        .sp-td.sorted{box-shadow:inset 2px 0 0 rgba(255,215,0,.18),inset -1px 0 0 rgba(255,215,0,.08);}
        .sp-even{background:rgba(0,0,22,.88);}
        .sp-odd {background:rgba(0,0,10,.92);}
        .sp-row{transition:background .1s;}
        .sp-row:hover td{background:rgba(255,130,0,0.14)!important;box-shadow:inset 0 1px 0 rgba(255,140,0,.25),inset 0 -1px 0 rgba(255,140,0,.25);}
        .sp-row:hover td:first-child{box-shadow:inset 4px 0 0 #FF8C00,inset 0 1px 0 rgba(255,140,0,.25),inset 0 -1px 0 rgba(255,140,0,.25);}
        .sp-row:hover .td-mgrname{color:#FF8C00!important;text-shadow:0 0 12px rgba(255,130,0,.6);}
        .sp-row:hover .td-teamcode{color:#FF8C00!important;text-shadow:0 0 12px rgba(255,130,0,.6);}
        .sp-row:hover .td-rank{color:rgba(255,180,0,.65);}
        .sp-row:hover .td-val{color:rgba(255,255,255,.98);}
        .sp-td{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.82);padding:.38rem .65rem;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap;transition:background .1s,box-shadow .1s,color .1s;}

        /* Team logo cell */
        .td-team{display:flex;align-items:center;gap:.5rem;min-width:100px;}
        .td-team-logo{width:32px;height:32px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 0 4px rgba(255,255,255,.15));}
        .td-team-logo-fb{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:rgba(255,140,0,.12);border:1.5px solid rgba(255,140,0,.3);font-family:'Press Start 2P',monospace;font-size:7px;color:#FF8C00;flex-shrink:0;letter-spacing:0;}
        .td-teamcode{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.9);letter-spacing:1px;transition:color .1s,text-shadow .1s;}

        /* Players Tab */
        .td-playername{font-family:'VT323',monospace;font-size:18px;color:rgba(255,255,255,.9);letter-spacing:.5px;white-space:nowrap;}
        .td-player-team{display:flex;align-items:center;justify-content:center;}
        .sp-row:hover .td-playername{color:#FF8C00;text-shadow:0 0 12px rgba(255,130,0,.6);}
        /* End Players */

        .td-mgr{display:flex;align-items:center;gap:.45rem;min-width:165px;}
        .td-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,.2);}
        .td-avatar-fb{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(135,206,235,.12);border:1.5px solid rgba(135,206,235,.28);font-family:'Press Start 2P',monospace;font-size:8px;color:#87CEEB;flex-shrink:0;}
        .td-mgr-names{display:flex;flex-direction:column;gap:1px;overflow:hidden;}
        .td-mgrname{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.9);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;transition:color .1s,text-shadow .1s;}
        .td-discord{font-family:'VT323',monospace;font-size:15px;color:rgba(114,137,218,.8);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
        .td-rank{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.22);transition:color .1s;}
        .td-val{transition:color .1s;}
        .td-champ{font-size:16px;}
        .td-val.great{color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .td-val.pos{color:#00DD55;text-shadow:0 0 8px rgba(0,221,85,.4);}
        .td-val.neg{color:#FF5555;text-shadow:0 0 8px rgba(255,85,85,.3);}

        
        .sp-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-spinner{width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,140,0,.15);border-top-color:#FF8C00;animation:spin .8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .sp-state-txt{font-family:'Press Start 2P',monospace;font-size:16px;color:rgba(255,255,255,.28);letter-spacing:3px;}
        .sp-state-sub{font-family:'VT323',monospace;font-size:20px;color:rgba(255,255,255,.2);text-align:center;max-width:520px;}
        .sp-placeholder{display:flex;flex-direction:column;align-items:center;gap:1.2rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-ph-title{font-family:'Press Start 2P',monospace;font-size:18px;color:rgba(255,255,255,.22);letter-spacing:4px;text-align:center;}
        .sp-ph-sub{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.18);text-align:center;max-width:500px;}
        .sp-ph-sub code{background:rgba(255,255,255,.08);padding:.1rem .3rem;border-radius:3px;font-size:18px;}

        .leg-item{display:flex;align-items:center;gap:.4rem;font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.28);}
        .leg-sw{display:inline-block;width:16px;height:14px;border-radius:3px;flex-shrink:0;}
        .sp-legend-footer{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.4rem;padding:.75rem 2rem;max-width:1600px;margin:0 auto;}
        .leg-note{font-family:'VT323',monospace;font-size:15px;color:rgba(255,255,255,.16);margin-left:auto;text-align:right;}

        @media(max-width:900px){
          .led-text{font-size:1.5rem;letter-spacing:4px;}
          .sp-tabs{padding:0 1.25rem;} .sp-tabs-line{left:1.25rem;right:1.25rem;}
          .sp-tab{font-size:12px;padding:.65rem 1.1rem;}
          .sp-filters{padding:.7rem 1.25rem;}
          .h2h-selectors{padding:.75rem 1.25rem;}
          .h2h-headline{margin-left:0;width:100%;}
        }
        @media(max-width:600px){
          .sp-tab{font-size:11px;padding:.6rem .9rem;}
          .sf-btn{font-size:11px;padding:.4rem .7rem;}
          .sp-td{font-size:20px;padding:.3rem .45rem;}
          .td-mgrname{font-size:10px;max-width:90px;}
          .td-discord{display:none;}
          .sf-count{display:none;}
          .sp-legend-inline{display:none;}
          .h2h-sel{min-width:150px;}
        }
      `}</style>
    </div>
  );
}
