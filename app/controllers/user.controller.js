exports.hello = (req, res) => {
  return res.status(200).send({ hello: 'world' })
}
