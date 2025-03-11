import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Player {
	player: string;
	spirit: string;
}

interface Play {
	date: string;
	players: Player[];
	adversary?: string;
	level?: number;
}

interface Spirit {
	spirit: string;
	complexity: string;
	source: string;
	image_url: string;
}

interface Adversary {
	Adversary: string;
	"Base Difficulty": number;
	"Additional Loss Condition": string;
	URL: string;
	Escalation: string;
	Levels: {
		Level: number;
		Difficulty: number;
		"Fear Cards": string;
		"Game Effects": string;
	}[];
}

interface PlayerStats {
	plays: number;
	lastPlayed: string | null;
}

interface PlayStats {
	spirit: Spirit;
	playerStats: Record<string, PlayerStats>;
}

interface AdversaryLevelStats {
	plays: number;
	lastPlayed: string | null;
	difficulty: number;
}

const SpiritIslandTracker = () => {
	const [plays, setPlays] = useState<Play[]>([]);
	const [spirits, setSpirits] = useState<Spirit[]>([]);
	const [adversaries, setAdversaries] = useState<Adversary[]>([]);
	const [sortConfig, setSortConfig] = useState<{
		key: string;
		direction: "asc" | "desc";
	} | null>(null);

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

	useEffect(() => {
		fetch("adversaries.json")
			.then((response) => response.json())
			.then((data) => setAdversaries(data))
			.catch((error) => console.error("Error fetching adversaries:", error));
	}, []);

	const uniquePlayers = Array.from(
		new Set(plays.flatMap((play) => play.players.map((p) => p.player))),
	)
		.filter((player) => player === "A" || player === "E")
		.sort();

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
					const currentLastPlayed =
						stats[spirit].playerStats[player].lastPlayed;

					if (!currentLastPlayed || playDate > new Date(currentLastPlayed)) {
						stats[spirit].playerStats[player].lastPlayed = play.date;
					}
				}
			});
		});

		return stats;
	};

	// In buildAdversaryStats function
	const buildAdversaryStats = (): Record<
		string,
		Record<number, AdversaryLevelStats>
	> => {
		const stats: Record<string, Record<number, AdversaryLevelStats>> = {};

		adversaries.forEach((adversary) => {
			stats[adversary.Adversary] = {};

			// Add level 0 (base adversary)
			stats[adversary.Adversary][0] = {
				plays: 0,
				lastPlayed: null,
				difficulty: adversary["Base Difficulty"],
			};

			// Add all defined levels - ensure level is treated as a number
			adversary.Levels.forEach((level) => {
				const levelNum = Number(level.Level);
				stats[adversary.Adversary][levelNum] = {
					plays: 0,
					lastPlayed: null,
					difficulty: level.Difficulty,
				};
			});
		});

		plays.forEach((play) => {
			if (play.adversary && stats[play.adversary]) {
				// Ensure level is treated as a number with default to 0
				const level = play.level !== undefined ? Number(play.level) : 0;

				if (stats[play.adversary][level]) {
					stats[play.adversary][level].plays += 1;

					const playDate = new Date(play.date);
					const currentLastPlayed = stats[play.adversary][level].lastPlayed;

					if (!currentLastPlayed || playDate > new Date(currentLastPlayed)) {
						stats[play.adversary][level].lastPlayed = play.date;
					}
				}
			}
		});

		return stats;
	};

	const playStats = buildPlayStats();
	const adversaryStats = buildAdversaryStats();

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "Never";
		return new Date(dateString).toLocaleDateString();
	};

	const getAdversaryRecommendation = () => {
		const recommendations: {
			adversary: string;
			level: number;
			difficulty: number;
			lastPlayed: string | null;
			reason: string;
		}[] = [];

		// Go through all adversaries and determine the next level to play
		adversaries.forEach((adversary) => {
			// Find the highest level played for this adversary
			let highestLevelPlayed = -1;
			let mostRecentDate: string | null = null;

			// Check all levels including base (0)
			for (let i = 0; i <= 6; i++) {
				// Skip if this level doesn't exist in our stats
				if (!adversaryStats[adversary.Adversary]?.[i]) continue;

				const levelStats = adversaryStats[adversary.Adversary][i];

				// If this level has been played
				if (levelStats.plays > 0) {
					highestLevelPlayed = Math.max(highestLevelPlayed, i);

					// Track the most recent play date across all levels
					if (levelStats.lastPlayed) {
						if (
							!mostRecentDate ||
							new Date(levelStats.lastPlayed) > new Date(mostRecentDate)
						) {
							mostRecentDate = levelStats.lastPlayed;
						}
					}
				}
			}

			// Determine next level to play (highest + 1, capped at 6)
			const nextLevel = Math.min(highestLevelPlayed + 1, 6);

			// Determine the difficulty of this level
			let difficulty: number;

			if (nextLevel === 0) {
				// Base adversary
				difficulty = adversary["Base Difficulty"];
			} else {
				// Find the corresponding level in the adversary data - ensure level comparison is numeric
				const levelData = adversary.Levels.find(
					(lvl) => Number(lvl.Level) === nextLevel,
				);
				difficulty = levelData
					? levelData.Difficulty
					: adversary["Base Difficulty"];
			}

			recommendations.push({
				adversary: adversary.Adversary,
				level: nextLevel,
				difficulty: difficulty,
				lastPlayed: mostRecentDate,
				reason: mostRecentDate
					? `Last played ${formatDate(mostRecentDate)}`
					: "Never played",
			});
		});

		// Sort recommendations by last played date (null/never played first, then oldest to newest)
		recommendations.sort((a, b) => {
			// Never played should come first
			if (a.lastPlayed === null && b.lastPlayed === null) return 0;
			if (a.lastPlayed === null) return -1;
			if (b.lastPlayed === null) return 1;

			// Otherwise sort by date (oldest first)
			return (
				new Date(a.lastPlayed).getTime() - new Date(b.lastPlayed).getTime()
			);
		});

		return recommendations;
	};

	const getRecommendations = () => {
		const recommendations: Record<
			string,
			Record<string, { spirit: Spirit; reason: string }>
		> = {};

		const complexityLevels = ["LOW", "MODERATE", "HIGH", "VERY HIGH"];

		uniquePlayers.forEach((player) => {
			recommendations[player] = {};

			complexityLevels.forEach((complexity) => {
				const complexitySpirits = spirits.filter(
					(s) => s.complexity === complexity,
				);

				const unplayedSpirits = complexitySpirits.filter(
					(s) => playStats[s.spirit].playerStats[player].plays === 0,
				);

				if (unplayedSpirits.length > 0) {
					const randomIndex = Math.floor(
						Math.random() * unplayedSpirits.length,
					);
					recommendations[player][complexity] = {
						spirit: unplayedSpirits[randomIndex],
						reason: "Never played",
					};
				} else {
					let oldestPlayedSpirit: Spirit | null = null;
					let oldestDate = new Date();

					complexitySpirits.forEach((s) => {
						const lastPlayed =
							playStats[s.spirit].playerStats[player].lastPlayed;

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
	const adversaryRecommendations = getAdversaryRecommendation();

	const handleSort = (key: string) => {
		let direction: "asc" | "desc" = "asc";
		if (
			sortConfig &&
			sortConfig.key === key &&
			sortConfig.direction === "asc"
		) {
			direction = "desc";
		}
		setSortConfig({ key, direction });
	};

	const sortedPlayStats = React.useMemo(() => {
		let sortableItems = Object.values(playStats);
		if (sortConfig !== null) {
			sortableItems.sort((a, b) => {
				if (sortConfig.key.startsWith("player-")) {
					const playerKey = sortConfig.key.split("-")[1];
					const statKey = sortConfig.key.split("-")[2];
					const aValue =
						a.playerStats[playerKey]?.[statKey] ||
						(statKey === "plays" ? 0 : "");
					const bValue =
						b.playerStats[playerKey]?.[statKey] ||
						(statKey === "plays" ? 0 : "");
					if (aValue < bValue) {
						return sortConfig.direction === "asc" ? -1 : 1;
					}
					if (aValue > bValue) {
						return sortConfig.direction === "asc" ? 1 : -1;
					}
					return 0;
				} else {
					if (
						a.spirit[sortConfig.key as keyof Spirit] <
						b.spirit[sortConfig.key as keyof Spirit]
					) {
						return sortConfig.direction === "asc" ? -1 : 1;
					}
					if (
						a.spirit[sortConfig.key as keyof Spirit] >
						b.spirit[sortConfig.key as keyof Spirit]
					) {
						return sortConfig.direction === "asc" ? 1 : -1;
					}
					return 0;
				}
			});
		}
		return sortableItems;
	}, [playStats, sortConfig]);

	const getDifficultyColor = (difficulty: number) => {
		if (difficulty <= 3) return "#34D399"; // Green for beginner
		if (difficulty <= 7) return "#FBBF24"; // Yellow for moderate
		if (difficulty <= 10) return "#F87171"; // Light red for challenging
		return "#EF4444"; // Dark red for expert
	};

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

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
				<div className="flex flex-col">
					<h2 className="text-xl font-semibold mb-4">Spirit Recommendations</h2>
					<div className="grid grid-cols-1 gap-4 flex-grow">
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
												<li
													key={complexity}
													className="grid grid-cols-[auto_1fr_auto] gap-4 text-left"
												>
													<div
														className="mx-4 p-2 h-4 rounded-full flex items-center justify-center"
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
													<a
														href={`#${rec.spirit.spirit}`}
														className="font-medium text-gray-200"
													>
														{rec.spirit.spirit}
													</a>
													<span className="text-sm text-gray-400 ml-2">
														({rec.reason})
													</span>
												</li>
											) : null,
									)}
								</ul>
							</motion.div>
						))}
					</div>
				</div>

				<div className="flex flex-col">
					<h2 className="text-xl font-semibold mb-4">
						Adversary Recommendations
					</h2>
					<motion.div
						className="border rounded-lg p-6 bg-gray-800 shadow-md flex-grow"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5 }}
					>
						<ul className="space-y-4">
							{adversaryRecommendations.map((rec) => (
								<li
									key={rec.adversary}
									className="grid grid-cols-[auto_1fr_auto] gap-4 text-left"
								>
									<div
										className="mr-2 p-2 w-4 h-4 rounded-full"
										style={{
											backgroundColor: getDifficultyColor(rec.difficulty),
										}}
									></div>
									<a
										href={`#${rec.adversary}`}
										className="font-medium text-gray-200"
									>
										{rec.adversary}{" "}
										{rec.level > 0 ? `(Level ${rec.level})` : "(Base)"}
									</a>
									<span className="text-sm text-gray-400 ml-2 flex flex-col items-center justify-center">
										<span>Difficulty {rec.difficulty}</span>
										<span>{rec.reason}</span>
									</span>
								</li>
							))}
						</ul>
					</motion.div>
				</div>
			</div>

			<div className="overflow-x-auto">
				<h2 className="text-2xl font-bold mb-6 text-gray-300">
					Spirits Statistics
				</h2>
				<table className="min-w-full border-collapse border rounded-lg shadow-lg overflow-hidden">
					<thead>
						<tr className="bg-gradient-to-r from-blue-700 to-purple-700 text-white">
							<th
								className="border p-4 text-left cursor-pointer"
								onClick={() => handleSort("spirit")}
							>
								Spirit
							</th>
							<th
								className="border p-4 text-left cursor-pointer"
								onClick={() => handleSort("complexity")}
							>
								Complexity
							</th>
							<th
								className="border p-4 text-left cursor-pointer"
								onClick={() => handleSort("source")}
							>
								Source
							</th>
							{uniquePlayers.map((player) => (
								<th key={player} className="border p-4 text-center" colSpan={2}>
									Player {player}
								</th>
							))}
						</tr>
						<tr className="bg-gray-700">
							<th className="border p-4 text-left" colSpan={3}></th>
							{uniquePlayers.flatMap((player) => [
								<th
									key={`${player}-plays`}
									className="border p-4 text-center cursor-pointer"
									onClick={() => handleSort(`player-${player}-plays`)}
								>
									Plays
								</th>,
								<th
									key={`${player}-last`}
									className="border p-4 text-center cursor-pointer"
									onClick={() => handleSort(`player-${player}-lastPlayed`)}
								>
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
										<span className="font-medium text-gray-200">
											{spirit.spirit}
										</span>
									</div>
								</td>
								<td className="border p-4">
									<span
										className={`px-3 py-1 rounded-full text-xs font-semibold ${spirit.complexity === "LOW"
												? "bg-green-200 text-green-900"
												: spirit.complexity === "MODERATE"
													? "bg-yellow-200 text-yellow-900"
													: "bg-red-200 text-red-900"
											}`}
									>
										{spirit.complexity}
									</span>
								</td>
								<td className="border p-4 text-sm text-gray-400">
									{spirit.source}
								</td>
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

			<div className="mt-8">
				<h2 className="text-2xl font-bold mb-6 text-gray-300">
					Adversary Statistics
				</h2>
				{adversaries.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{adversaries.map((adversary) => (
							<motion.div
								key={adversary.Adversary}
								id={adversary.Adversary}
								className="border rounded-lg p-6 bg-gray-800 shadow-md"
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.5 }}
							>
								<h3 className="text-xl font-medium mb-3">
									<a
										href={adversary.URL}
										className="text-indigo-400"
										target="_blank"
										rel="noopener noreferrer"
									>
										{adversary.Adversary}
									</a>
								</h3>
								<div className="mb-4 text-sm text-gray-400">
									<p>
										<strong>Base Difficulty:</strong>{" "}
										{adversary["Base Difficulty"]}
									</p>
								</div>

								<table className="min-w-full border-collapse border rounded-lg shadow-md overflow-hidden">
									<thead>
										<tr className="bg-gray-700">
											<th className="border p-2 text-left">Level</th>
											<th className="border p-2 text-left">Difficulty</th>
											<th className="border p-2 text-left">Plays</th>
											<th className="border p-2 text-left">Last Played</th>
										</tr>
									</thead>
									<tbody>
										{/* Base level */}
										<tr className="hover:bg-gray-800 transition duration-200">
											<td className="border p-2">Base</td>
											<td className="border p-2">
												<span
													className="px-2 py-1 rounded-full text-xs font-semibold"
													style={{
														backgroundColor: getDifficultyColor(
															adversary["Base Difficulty"],
														),
														color:
															adversary["Base Difficulty"] > 7
																? "white"
																: "black",
													}}
												>
													{adversary["Base Difficulty"]}
												</span>
											</td>
											<td className="border p-2">
												{adversaryStats[adversary.Adversary][0]?.plays || 0}
											</td>
											<td className="border p-2 text-sm text-gray-400">
												{formatDate(
													adversaryStats[adversary.Adversary][0]?.lastPlayed,
												)}
											</td>
										</tr>

										{/* All defined levels */}
										{adversary.Levels.map((level) => {
											const levelNum = Number(level.Level);
											return (
												<tr
													key={`${adversary.Adversary}-${levelNum}`}
													className="hover:bg-gray-800 transition duration-200"
												>
													<td className="border p-2">{levelNum}</td>
													<td className="border p-2">
														<span
															className="px-2 py-1 rounded-full text-xs font-semibold"
															style={{
																backgroundColor: getDifficultyColor(
																	level.Difficulty,
																),
																color: level.Difficulty > 7 ? "white" : "black",
															}}
														>
															{level.Difficulty}
														</span>
													</td>
													<td className="border p-2">
														{adversaryStats[adversary.Adversary][levelNum]
															?.plays || 0}
													</td>
													<td className="border p-2 text-sm text-gray-400">
														{formatDate(
															adversaryStats[adversary.Adversary][levelNum]
																?.lastPlayed,
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</motion.div>
						))}
					</div>
				) : (
					<p className="text-gray-400">Loading adversary data...</p>
				)}
			</div>

			<div className="mt-8">
				<h2 className="text-xl font-semibold mb-2">Summary</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{uniquePlayers.map((player) => {
						const playerTotalPlays = Object.values(playStats).reduce(
							(total, { playerStats }) =>
								total + (playerStats[player]?.plays || 0),
							0,
						);

						const mostPlayedSpirit = Object.values(playStats).reduce(
							(most, { spirit, playerStats }) => {
								const plays = playerStats[player]?.plays || 0;
								return plays > (most?.plays || 0)
									? { spirit: spirit.spirit, plays }
									: most;
							},
							{ spirit: "", plays: 0 },
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
