import json
import xml.etree.ElementTree as ET
from typing import DefaultDict, List, Optional

import requests


def main():
    with open("public/spirits.json") as f:
        spirits = json.load(f)
    with open("public/adversaries.json") as f:
        adversaries = json.load(f)
    plays_raw = get_logged_plays(game_ids=[162886])
    print(plays_raw)
    processed_plays = process_plays(plays_raw, spirits, adversaries)
    print(processed_plays)
    with open("public/plays.json", "w") as f:
        json.dump(processed_plays, f)


def process_plays(plays_raw, spirits, adversaries):
    processed_plays = []
    for play in plays_raw:
        comment = play.get("comment")
        if not comment:
            continue
        comment_parts = comment.split("\n")
        adversary_full = comment_parts[0]
        adversary_raw, level_raw = adversary_full.split(" L")
        adversary = find_adversary(adversaries, adversary_raw)
        if " " in level_raw:
            level, comment = level_raw.split(" ", 1)
        else:
            level = level_raw
            comment = ""
        level = int(level)
        # Check if last line indicates a loss
        last_line = comment_parts[-1].lower()
        won = not last_line.startswith("lost")
        
        # If the last line is "lost", then map is the second to last line
        if not won:
            map_raw = comment_parts[-2] if len(comment_parts) >= 2 else ""
            players_raw = comment_parts[1:-2] if len(comment_parts) >= 3 else comment_parts[1:-1]
        else:
            map_raw = comment_parts[-1]
            players_raw = comment_parts[1:-1]
        
        players = []
        for player_raw in players_raw:
            if ": " not in player_raw:
                continue
            player, spirit_raw = player_raw.split(": ")
            spirit = find_spirit(spirits, spirit_raw)
            if spirit is None:
                print(f"Could not find spirit: {spirit_raw}")
                continue
            players.append({"player": player, "spirit": spirit})
        play_data = {
            "play_id": play.get("play_id"),
            "date": play.get("date"),
            "adversary": adversary,
            "level": level,
            "map": map_raw,
            "players": players,
            "comment": comment,
            "won": won,
        }
        processed_plays.append(play_data)
    fake_play_data = get_fake_play_data(processed_plays, spirits)
    processed_plays.extend(fake_play_data)
    return processed_plays


def get_fake_play_data(processed_plays, spirits):
    """Add all the spirits of the base game with the date 2024-04-01"""
    spirits_already_played_by_players = DefaultDict(set)
    for play in processed_plays:
        if play["date"] <= "2025-03-01":
            for player in play["players"]:
                spirit = player["spirit"]
                spirits_already_played_by_players[player["player"]].add(spirit)
    fake_play_data = []
    all_players_data = []
    base_game_spirits = [s for s in spirits if s["source"] == "Base Game"]
    for spirit in base_game_spirits:
        for player in ["A", "E"]:
            if spirit["spirit"] in spirits_already_played_by_players[player]:
                continue
            player_data = {"player": player, "spirit": spirit["spirit"]}
            all_players_data.append(player_data)
    fake_play = {
        "play_id": None,
        "date": "2023-04-01",
        "adversary": None,
        "level": None,
        "map": None,
        "players": all_players_data,
        "won": True,
    }
    fake_play_data.append(fake_play)

    all_players_data = []
    selected_spirits = [s for s in spirits if s["source"] == "Jagged Earth"]
    for spirit in selected_spirits:
        for player in ["A", "E"]:
            if spirit["spirit"] in spirits_already_played_by_players[player]:
                continue
            player_data = {"player": player, "spirit": spirit["spirit"]}
            all_players_data.append(player_data)
    fake_play = {
        "play_id": None,
        "date": "2024-04-01",
        "adversary": None,
        "level": None,
        "map": None,
        "players": all_players_data,
        "won": True,
    }
    fake_play_data.append(fake_play)
    return fake_play_data


def find_spirit(spirits, spirit_raw):
    for spirit in spirits:
        spirit_name = spirit["spirit"]
        if spirit_raw.lower() in spirit_name.lower():
            return spirit_name
    return None


def find_adversary(adversaries, adversary_raw):
    for adversary in adversaries:
        adversary_name = adversary["Adversary"]
        if adversary_raw.lower() in adversary_name.lower():
            return adversary_name
    return None


def get_logged_plays(
    game_ids: Optional[List[int]] = None,
    last_n: Optional[int] = None,
    since: Optional[str] = None,
):
    username = "nraw"
    base_url = f"https://www.boardgamegeek.com/xmlapi2/plays?username={username}"
    plays = []
    page = 1

    while True:
        url = f"{base_url}&page={page}"
        if since is not None:
            url += f"&mindate={since}"
        response = requests.get(url)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        all_plays = root.findall("play")

        if not all_plays:
            break

        i = 0
        for play in all_plays:
            if last_n and i >= last_n:
                break
            if since is not None:
                play_date = play.get("date", "")
                if play_date < since:
                    break
            play_id = play.get("id")
            date = play.get("date")
            game_item = play.find("item")
            if game_item:
                game = game_item.get("name")
                game_id = game_item.get("objectid")
                if (
                    game_ids is not None
                    and game_id is not None
                    and int(game_id) not in game_ids
                ):
                    continue
            else:
                raise ValueError
            comments = play.find("comments")
            comment = comments.text if comments is not None else None
            play_info = dict(
                play_id=play_id, date=date, game=game, game_id=game_id, comment=comment
            )
            plays.append(play_info)
            i += 1

        page += 1

    return plays


if __name__ == "__main__":
    main()
