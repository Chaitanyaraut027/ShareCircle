import User from '../models/user.model.js';

export const getLeaderboard = async (req, res) => {
  try {
    // We use aggregation to count real donations associated with each user in real-time
    const leaderboard = await User.aggregate([
      {
        $lookup: {
          from: 'donations',
          localField: '_id',
          foreignField: 'donor',
          as: 'donationsList'
        }
      },
      {
        $project: {
          fullName: 1,
          profilePic: 1,
          donationCount: { $size: '$donationsList' },
          rewardPoints: { $multiply: [{ $size: '$donationsList' }, 25] }, // Match dashboard's 25pts per donation
          livesSaved: { $multiply: [{ $size: '$donationsList' }, 5] }
        }
      },
      { $sort: { donationCount: -1, rewardPoints: -1 } },
      { $limit: 30 }
    ]);

    const formatted = leaderboard.map((u, index) => ({
      _id: u._id,
      fullName: u.fullName,
      profilePic: u.profilePic,
      donationCount: u.donationCount || 0,
      rewardPoints: u.rewardPoints || 0,
      livesSaved: u.livesSaved || 0,
      rank: index + 1
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
};
