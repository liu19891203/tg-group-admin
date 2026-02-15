module.exports = async (req, res) => {
  console.log('Simple webhook received:', req.method);
  
  res.status(200).json({ 
    ok: true, 
    message: 'Simple webhook working',
    method: req.method
  });
};
