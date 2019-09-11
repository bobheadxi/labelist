const axios = require('axios');

const todoistClient = axios.create({
  baseURL: 'https://api.todoist.com/rest/v1',
  headers: {
    Authorization: `Bearer ${process.env.TODOIST_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function appendLabel(event) {
  const { content, labels } = event;

  // check for @ tags
  const tags = content.match(/@([^\s]+)/g);
  if (!tags || tags.length < 1) {
    console.log('no tags in content');
    return { msg: 'no tags in item' };
  }
  console.log('found tags', { tags });

  // get labels for codes
  const labelsResponse = await todoistClient.get('/labels');
  const { data: userLabels } = labelsResponse;
  console.log('found labels', { userLabels });

  // make update to task
  const diff = {
    content: tags.reduce((acc, t) => acc.replace(t, ''), content || '').trim(),
    label_ids: tags.reduce((acc, t) => {
      const l = userLabels.find((v) => `@${v.name}` === t);
      // TODO: if label doesn't exist, maybe this should create the label
      if (l && !acc.includes(l.id)) acc.push(l.id);
      return acc;
    }, labels || []),
  };
  console.log('updating with diff', { diff });
  const update = await todoistClient.post(`/tasks/${event.id}`, diff);
  console.log('update ok', { status: update.status });

  return update.data;
}

module.exports = async (req, res) => {
  const { method, body } = req;
  console.log('request received', { method, body });
  try {
    const { event_name, event_data } = body;
    let handlerResp;
    switch (event_name) {
      case 'item:updated':
      case 'item:added':
        handlerResp = await appendLabel(event_data);
        res.status(200).json(handlerResp);
        break;
      default:
        res.status(400).json({ msg: `unsupported event type ${body}` });
    }
  } catch (e) {
    console.error('unexpected error occured', { error: e });
    res.status(500).json({
      message: 'an error occured while processing the request',
    });
  }
};
