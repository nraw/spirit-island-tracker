import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Player {
  player: string;
  spirit: string;
}

interface Play {
  date: string;
  players: Player[];
}

interface Spirit {
  spirit: string;
  complexity: string;
  source: string;
  image_url: string;
}

interface PlayerStats {
  plays: number;
  lastPlayed: string | null;
}

interface PlayStats {
  spirit: Spirit;
  playerStats: Record<string, PlayerStats>;
}

const SpiritIslandTracker = () => {
  const [plays, setPlays] = useState<Play[]>([]);
  const [spirits, setSpirits] = useState<Spirit[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    fetch("plays.json")
      .then((response) => response.json())
      .then((data) => setPlays(data))
      .catch((error) => console.error("Error fetching plays:", error));
  }, []);

  useEffect(() => {
    fetch("spirits.json")
      .then((response) => response.json())
      .then((data) => setSpirits(data))
      .catch((error) => console.error("Error fetching spirits:", error));
  }, []);

  const uniquePlayers = Array.from(
    new Set(plays.flatMap((play) => play.players.map((p) => p.player)))
  ).filter((player) => player === "A" || player === "E").sort();

  const buildPlayStats = (): Record<string, PlayStats> => {
    const stats: Record<string, PlayStats> = {};

    spirits.forEach((spirit) => {
      stats[spirit.spirit] = {
        spirit: spirit,
        playerStats: {},
      };

      uniquePlayers.forEach((player) => {
        stats[spirit.spirit].playerStats[player] = {
          plays: 0,
          lastPlayed: null,
        };
      });
    });

    plays.forEach((play) => {
      play.players.forEach(({ player, spirit }) => {
        if (stats[spirit] && stats[spirit].playerStats[player]) {
          stats[spirit].playerStats[player].plays += 1;

          const playDate = new Date(play.date);
          const currentLastPlayed = stats[spirit].playerStats[player].lastPlayed;

          if (!currentLastPlayed || playDate > new Date(currentLastPlayed)) {
            stats[spirit].playerStats[player].lastPlayed = play.date;
          }
        }
      });
    });

    return stats;
  };

  const playStats = buildPlayStats();

  const getRecommendations = () => {
    const recommendations: Record<string, Record<string, { spirit: Spirit; reason: string }>> = {};

    const complexityLevels = ["LOW", "MODERATE", "HIGH", "VERY HIGH"];

    uniquePlayers.forEach((player) => {
      recommendations[player] = {};

      complexityLevels.forEach((complexity) => {
        const complexitySpirits = spirits.filter((s) => s.complexity === complexity);

        const unplayedSpirits = complexitySpirits.filter(
          (s) => playStats[s.spirit].playerStats[player].plays === 0
        );

        if (unplayedSpirits.length > 0) {
          const randomIndex = Math.floor(Math.random() * unplayedSpirits.length);
          recommendations[player][complexity] = {
            spirit: unplayedSpirits[randomIndex],
            reason: "Never played",
          };
        } else {
          let oldestPlayedSpirit: Spirit | null = null;
          let oldestDate = new Date();

          complexitySpirits.forEach((s) => {
            const lastPlayed = playStats[s.spirit].playerStats[player].lastPlayed;

            if (lastPlayed && new Date(lastPlayed) < oldestDate) {
              oldestDate = new Date(lastPlayed);
              oldestPlayedSpirit = s;
            }
          });

          if (oldestPlayedSpirit) {
            recommendations[player][complexity] = {
              spirit: oldestPlayedSpirit,
              reason: `Last played ${oldestDate.toLocaleDateString()}`,
            };
          }
        }
      });
    });

    return recommendations;
  };

  const recommendations = getRecommendations();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayStats = React.useMemo(() => {
    let sortableItems = Object.values(playStats);
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key.startsWith('player-')) {
          const playerKey = sortConfig.key.split('-')[1];
          const statKey = sortConfig.key.split('-')[2];
          const aValue = a.playerStats[playerKey]?.[statKey] || (statKey === 'plays' ? 0 : '');
          const bValue = b.playerStats[playerKey]?.[statKey] || (statKey === 'plays' ? 0 : '');
          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        } else {
          if (a.spirit[sortConfig.key as keyof Spirit] < b.spirit[sortConfig.key as keyof Spirit]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a.spirit[sortConfig.key as keyof Spirit] > b.spirit[sortConfig.key as keyof Spirit]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableItems;
  }, [playStats, sortConfig]);

  return (
    <div className="p-4 max-w-6xl mx-auto text-white">
      <motion.h1
        className="text-4xl font-extrabold mb-8 text-center text-indigo-400"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Spirit Island Play Tracker
      </motion.h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Spirit Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uniquePlayers.map((player) => (
            <motion.div
              key={player}
              className="border rounded-lg p-6 bg-gray-800 shadow-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-lg font-medium mb-4">Player {player}</h3>
              <ul className="space-y-4">
                {Object.entries(recommendations[player]).map(
                  ([complexity, rec]) =>
                    rec?.spirit ? (
                      <li key={complexity} className="flex items-center space-x-4">
                        <div
                          className="mr-2 p-2 w-4 h-4 rounded-full"
                          style={{
                            backgroundColor:
                              complexity === "LOW"
                                ? "#34D399"
                                : complexity === "MODERATE"
                                ? "#FBBF24"
                                : complexity === "HIGH"
                                ? "#F87171"
                                : "#EF4444",
                          }}
                        ></div>
                        <a href={`#${rec.spirit.spirit}`} className="font-medium text-gray-200">
                          {rec.spirit.spirit}
                        </a>
                        <span className="text-sm text-gray-400 ml-2">({rec.reason})</span>
                      </li>
                    ) : null
                )}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-300">Play Statistics</h2>
        <table className="min-w-full border-collapse border rounded-lg shadow-lg overflow-hidden">
          <thead>
            <tr className="bg-gradient-to-r from-blue-700 to-purple-700 text-white">
              <th className="border p-4 text-left cursor-pointer" onClick={() => handleSort('spirit')}>Spirit</th>
              <th className="border p-4 text-left cursor-pointer" onClick={() => handleSort('complexity')}>Complexity</th>
              <th className="border p-4 text-left cursor-pointer" onClick={() => handleSort('source')}>Source</th>
              {uniquePlayers.map((player) => (
                <th key={player} className="border p-4 text-center" colSpan={2}>
                  Player {player}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-700">
              <th className="border p-4 text-left" colSpan={3}></th>
              {uniquePlayers.flatMap((player) => [
                <th key={`${player}-plays`} className="border p-4 text-center cursor-pointer" onClick={() => handleSort(`player-${player}-plays`)}>
                  Plays
                </th>,
                <th key={`${player}-last`} className="border p-4 text-center cursor-pointer" onClick={() => handleSort(`player-${player}-lastPlayed`)}>
                  Last Played
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {sortedPlayStats.map(({ spirit, playerStats }) => (
              <motion.tr
                key={spirit.spirit}
                id={spirit.spirit}
                className="hover:bg-gray-800 transition duration-200"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <td className="border p-4">
                  <div className="flex items-center">
                    <img
                      src={spirit.image_url}
                      alt={spirit.spirit}
                      className="mr-4 w-16 h-16 rounded-full object-cover object-center shadow-md"
                    />
                    <span className="font-medium text-gray-200">{spirit.spirit}</span>
                  </div>
                </td>
                <td className="border p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      spirit.complexity === "LOW"
                        ? "bg-green-200 text-green-900"
                        : spirit.complexity === "MODERATE"
                        ? "bg-yellow-200 text-yellow-900"
                        : "bg-red-200 text-red-900"
                    }`}
                  >
                    {spirit.complexity}
                  </span>
                </td>
                <td className="border p-4 text-sm text-gray-400">{spirit.source}</td>
                {uniquePlayers.flatMap((player) => [
                  <td
                    key={`${spirit.spirit}-${player}-plays`}
                    className="border p-4 text-center text-gray-200"
                  >
                    {playerStats[player]?.plays || 0}
                  </td>,
                  <td
                    key={`${spirit.spirit}-${player}-last`}
                    className="border p-4 text-center text-sm text-gray-400"
                  >
                    {formatDate(playerStats[player]?.lastPlayed)}
                  </td>,
                ])}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uniquePlayers.map((player) => {
            const playerTotalPlays = Object.values(playStats).reduce(
              (total, { playerStats }) =>
                total + (playerStats[player]?.plays || 0),
              0
            );

            const mostPlayedSpirit = Object.values(playStats).reduce(
              (most, { spirit, playerStats }) => {
                const plays = playerStats[player]?.plays || 0;
                return plays > (most?.plays || 0)
                  ? { spirit: spirit.spirit, plays }
                  : most;
              },
              { spirit: "", plays: 0 }
            );

            return (
              <motion.div
                key={player}
                className="border rounded p-4 bg-gray-800"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="font-medium">Player {player}</h3>
                <p>Total plays: {playerTotalPlays}</p>
                {mostPlayedSpirit.plays > 0 && (
                  <p className="text-sm">
                    Favorite spirit: {mostPlayedSpirit.spirit} (
                    {mostPlayedSpirit.plays} plays)
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpiritIslandTracker;
