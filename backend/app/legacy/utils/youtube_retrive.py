import os
import googleapiclient.discovery
import googleapiclient.errors
import isodate
import math
from datetime import datetime, timedelta
from log import logger
from dotenv import load_dotenv
load_dotenv()
# from apollo import get_youtube_api_key
# Replace with your API key
API_KEY = os.getenv("YOUTUBE_API_KEY")
if not API_KEY:
    logger.error("YOUTUBE_API_KEY is not set")
    exit(1)
api_service_name = "youtube"
api_version = "v3"

youtube = googleapiclient.discovery.build(
    api_service_name, api_version, developerKey=API_KEY)

async def get_and_format_youtube_videos(query="surfing", max_results=10, published_after=None):
    """
    Retrieves and formats YouTube video information based on a search query.

    Args:
        query: The search query string.
        max_results: The maximum number of results to return.
        published_after: A string in RFC 3339 format (e.g., "2023-01-01T00:00:00Z")
                         to filter results published after this date. Defaults to 3 years ago.

    Returns:
        A list of dictionaries, each containing formatted video details.
    """
    # Calculate default published_after date if not provided
    if published_after is None:
        three_years_ago = datetime.now() - timedelta(days=3*365) # Approximate 3 years
        published_after = three_years_ago.isoformat("T") + "Z"


    # Perform the search
    try:
        search_request = youtube.search().list(
            part="snippet",
            maxResults=max_results,
            q=query,
            type="video", # Ensure only videos are returned
            publishedAfter=published_after,
            order="rating"# Add publishedAfter parameter
        )
        search_response = search_request.execute()
    except Exception as e:
        logger.error(f"[Youtube Search] 获取视频推荐id失败: {e}",exc_info=True)
        return []

    video_ids = []
    video_details = {}

    # Extract video IDs and initial details from search results
    for item in search_response.get('items', []):
        if item['id']['kind'] == 'youtube#video':
            video_id = item['id']['videoId']
            video_ids.append(video_id)
            video_details[video_id] = {
                'video_id': video_id,
                'title': item['snippet']['title'],
                'description': item['snippet']['description'],
                'cover': item['snippet']['thumbnails']['default']['url'],
                'url': f"https://www.youtube.com/watch?v={video_id}"
            }

    if not video_ids:
        return []

    # Fetch content details (including duration) for the extracted video IDs
    try:
        videos_request = youtube.videos().list(
            part="contentDetails",
            id=",".join(video_ids)
        )
        videos_response = videos_request.execute()
    except Exception as e:
        logger.error(f"[Youtube Search] 获取视频推荐内容失败: {e}",exc_info=True)
        return []

    # Add duration to video details
    for item in videos_response.get('items', []):
        video_id = item['id']
        duration_iso = item['contentDetails']['duration']
        try:
            duration_seconds = isodate.parse_duration(duration_iso).total_seconds()
            video_details[video_id]['duration_seconds'] = duration_seconds
            # Remove formatted duration
            hours = math.floor(duration_seconds / 3600)
            minutes = math.floor((duration_seconds % 3600) / 60)
            seconds = math.floor(duration_seconds % 60)
            video_details[video_id]['duration'] = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
        except Exception as e:
            print(f"Error parsing duration for video {video_id}: {e}")
            video_details[video_id]['duration_seconds'] = 0
            # Remove formatted duration
            video_details[video_id]['duration'] = "N/A"


    # Convert dictionary to a list of dictionaries for easier processing
    formatted_video_list = list(video_details.values())

    return formatted_video_list

# Example usage:
# youtube_videos = get_and_format_youtube_videos("python programming", 10)
# for video in youtube_videos:
#     print(video)


async def rank_videos_by_duration(video_list):
    """
    Applies a duration-weighted ranking to a list of video data.

    Args:
        video_list: A list of dictionaries, each containing video details,
                    including 'duration_seconds' and 'original_rank' (optional).

    Returns:
        A list of dictionaries, each representing a video with its details and
        calculated score, sorted by score.
    """
    if not video_list:
        return []

    # Ensure original_rank is present
    for i, video in enumerate(video_list):
        if 'original_rank' not in video:
            video['original_rank'] = i

    duration_seconds_list = [video['duration_seconds'] for video in video_list if 'duration_seconds' in video]

    if not duration_seconds_list:
         # If no videos have duration_seconds, just return sorted by original rank
         ranked_data = sorted(video_list, key=lambda x: x.get('original_rank', float('inf')))
         # Remove temporary fields except duration_seconds
         for item in ranked_data:
             item.pop('original_rank', None)
             item.pop('score', None)
         return ranked_data


    # Calculate duration scores
    max_duration = max(duration_seconds_list) if duration_seconds_list else 1
    min_duration = min(duration_seconds_list) if duration_seconds_list else 0
    duration_range = max_duration - min_duration if max_duration != min_duration else 1

    ranked_data = []
    for video in video_list:
        if 'duration_seconds' in video:
            # Calculate duration score (shorter is better)
            duration_score = 1 - (video['duration_seconds'] - min_duration) / duration_range

            # Calculate original rank score (higher original rank is worse)
            # Assuming original_rank is 0-indexed
            rank_score = 1 / (video.get('original_rank', len(video_list)) + 1)

            # Calculate combined score (adjust weights as needed)
            video['score'] = 0.6 * duration_score + 0.4 * rank_score
            ranked_data.append(video)
        else:
            # Handle videos without duration_seconds if necessary, e.g., assign a default score or skip
            pass


    # Sort by combined score in descending order
    ranked_data.sort(key=lambda x: x['score'], reverse=True)

    # Remove temporary fields except duration_seconds
    for item in ranked_data:
        item.pop('original_rank', None)
        item.pop('score', None)


    return ranked_data

# Example usage:
# Assuming 'youtube_videos' is the output from get_and_format_youtube_videos
# ranked_videos = rank_videos_by_duration(youtube_videos)
# for video in ranked_videos:
#     print(video)

async def retrive_youtube_rerank(query,**kwargs):
    try:
        youtube_videos = await get_and_format_youtube_videos(query,**kwargs)
        ranked_videos = await rank_videos_by_duration(youtube_videos)
        return ranked_videos
    except Exception as e:
        logger.error(f"[Youtube Retrive] 获取视频推荐失败: {e}",exc_info=True)
        return []




