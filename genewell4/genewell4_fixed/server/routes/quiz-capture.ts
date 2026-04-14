import { RequestHandler } from 'express';
import { getOrCreateUser, saveQuizSubmission, saveDownload } from '../lib/db';
import { sendConfirmationEmail, isEmailServiceAvailable } from '../lib/email-service';

export const handleQuizCapture: RequestHandler = async (req, res) => {
  try {
    const {
      userName,
      userEmail,
      userPhone,
      userAge,
      userGender,
      userLocation,
      quizData,
      analysisId,
    } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';

    let user = null;
    try {
      user = await getOrCreateUser(
        userEmail,
        userName,
        userPhone || null,
        userAge || null,
        userGender || null,
        userLocation || null
      );
    } catch (err) {
      console.error('Error creating/getting user:', err);
    }

    try {
      await saveQuizSubmission({
        userId: user?.id || null,
        userName,
        userEmail,
        userPhone: userPhone || null,
        userAge: userAge || null,
        userGender: userGender || null,
        userLocation: userLocation || null,
        quizData: quizData || {},
        analysisId: analysisId || null,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      console.error('Error saving quiz submission:', err);
    }

    res.json({
      success: true,
      userId: user?.id || null,
      message: 'Quiz data captured successfully',
    });
  } catch (error) {
    console.error('Quiz capture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to capture quiz data',
    });
  }
};
