const { logger } = require('./../../context')

exports.post = ({ appSdk }, req, res) => {
  // force update tokens service
  try {
    appSdk.updateTokens()
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
  res.status(204).send()
}
