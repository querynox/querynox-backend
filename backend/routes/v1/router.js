const express = require('express');
const router = express.Router();
const path = require("path")

const chatRouter = require('./chatRouter')
const paymentsRouter = require('./paymentRouter')
const userRouter = require('./userRouter');
const publicRouter = require('./sharePublicRouter');

router.use('/chat',chatRouter)
router.use('/payments',paymentsRouter)
router.use('/user',userRouter)
router.use('/public', publicRouter)
router.get('/download/:filename', (req,res) => {//TODO: Remove in Prod : Use S3 Download URL directly
  const filePath = path.join(process.cwd(), "public", "generated_images", req.params.filename);
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
  res.sendFile(filePath);
})

module.exports = router;