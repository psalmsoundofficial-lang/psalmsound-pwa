exports.handler = async function (event) {
  const YT_KEY = process.env.YOUTUBE_API_KEY;

  if (!YT_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'YouTube API key is not configured.' })
    };
  }

  const params = new URLSearchParams(event.queryStringParameters || {});
  const playlistId = params.get('playlistId');
  const pageToken = params.get('pageToken');

  if (!playlistId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing playlistId.' })
    };
  }

  const youtubeParams = new URLSearchParams({
    part: 'snippet',
    playlistId: playlistId,
    maxResults: '50',
    key: YT_KEY
  });

  if (pageToken) youtubeParams.set('pageToken', pageToken);

  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/playlistItems?' +
      youtubeParams.toString()
    );

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to contact YouTube.' })
    };
  }
};
