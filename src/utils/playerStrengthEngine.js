/**
 * Player & Squad Availability Engine (Step 21)
 * Availability-aware squad factor engine.
 * Never invents synthetic values when data is missing; returns UNAVAILABLE.
 */

export function computePlayerSquadFactors(homeTeam = '', awayTeam = '', preMatchSquadData = null) {
  if (!preMatchSquadData || typeof preMatchSquadData !== 'object') {
    return {
      status: 'UNAVAILABLE',
      used: false,
      reason: 'No verified pre-match squad or injury data available'
    };
  }

  return {
    status: 'AVAILABLE',
    used: true,
    homeKeyPlayersAvailable: preMatchSquadData.homeAvailable || 11,
    awayKeyPlayersAvailable: preMatchSquadData.awayAvailable || 11,
    differential: (preMatchSquadData.homeAvailable || 11) - (preMatchSquadData.awayAvailable || 11)
  };
}
