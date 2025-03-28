import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY
);

const ratingEmojis = {
    5: '🎉 Excellent',
    4: '😊 Good',
    3: '😐 Average',
    2: '🙁 Below Average',
    1: '😢 Poor'
};

function App() {
    const [votes, setVotes] = useState([]);
    const [score, setScore] = useState('');
    const [voteCounts, setVoteCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [totalVotes, setTotalVotes] = useState(0);
    const [user, setUser] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Get current session
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user ?? null);

                // Fetch votes
                const { data: votesData, error: votesError } = await supabase.from('votes').select('*');
                if (votesError) throw votesError;

                setVotes(votesData || []);
                updateVoteCounts(votesData || []);

                // Check if current user has voted
                if (session?.user) {
                    const { data: userVotes, error: votedError } = await supabase
                        .from('votes')
                        .select('*')
                        .eq('user_id', session.user.id);

                    if (votedError) throw votedError;
                    setHasVoted(userVotes?.length > 0 || false);
                }
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };

        fetchInitialData();

        // Real-time subscription
        const channel = supabase
            .channel('votes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, (payload) => {
                setVotes((prevVotes) => [...prevVotes, payload.new]);
                setVoteCounts((prevCounts) => {
                    const newCounts = { ...prevCounts };
                    newCounts[payload.new.score] += 1;
                    return newCounts;
                });
                setTotalVotes((prev) => prev + 1);
            })
            .subscribe();

        // Auth state change listener
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                // Check if the new user has voted
                const checkUserVotes = async () => {
                    const { data: userVotes, error } = await supabase
                        .from('votes')
                        .select('*')
                        .eq('user_id', session.user.id);

                    if (error) {
                        console.error('Error checking user votes:', error);
                        return;
                    }

                    setHasVoted(userVotes?.length > 0 || false);
                };

                checkUserVotes();
            }
        });

        return () => {
            supabase.removeChannel(channel);
            authListener.subscription.unsubscribe();
        };
    }, []);

    const updateVoteCounts = (voteData) => {
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        voteData.forEach((vote) => {
            counts[vote.score] += 1;
        });
        setVoteCounts(counts);
        setTotalVotes(voteData.length);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: "https://wasinuddy.github.io/supabase-rate-my-talk/" }
        });
        if (error) console.error('Error logging in with Google:', error);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setHasVoted(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            alert('Please log in to vote');
            return;
        }
        if (!score) {
            alert('Please select a score');
            return;
        }
        if (hasVoted) {
            alert('You have already voted!');
            return;
        }

        const { error } = await supabase
            .from('votes')
            .insert({
                user_id: user.id, // Use the UUID (user.id) instead of email
                score: parseInt(score)
            });

        if (error) {
            console.error('Error submitting vote:', error);
            alert('Failed to submit vote');
        } else {
            setScore('');
            setHasVoted(true);

            // Call Edge Function to send thank-you email
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await fetch('https://skzxyfgshjirgryilwgh.supabase.co/functions/v1/send-thank-you-email', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: user.email })
                });
            } catch (emailError) {
                console.error('Error sending thank you email:', emailError);
            }
        }
    };

    const renderVoteBar = (rating) => {
        const percentage = totalVotes > 0
            ? ((voteCounts[rating] / totalVotes) * 100).toFixed(1)
            : 0;

        return (
            <div key={rating} className="mb-2">
                <div className="flex items-center">
                    <div className="w-16 text-left">{ratingEmojis[rating]}</div>
                    <div className="flex-grow bg-gray-700 rounded-full h-2.5 mr-2 overflow-hidden">
                        <div
                            className="bg-green-500 h-2.5 rounded-full transition-all duration-700 ease-in-out"
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                    <div className="w-12 text-right">
                        {voteCounts[rating]} ({percentage}%)
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-800 shadow-2xl rounded-2xl p-6 border border-gray-700">
                <h1 className="text-3xl font-bold mb-4 text-center text-green-500">Rate My Talk!</h1>
                {!user ? (
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-blue-600 text-white p-3 rounded-lg mb-4 hover:bg-blue-700 transition-colors duration-300"
                    >
                        Login with Google
                    </button>
                ) : (
                    <div className="mb-4">
                        <p className="text-center">Logged in as: {user.email}</p>
                        <button
                            onClick={handleLogout}
                            className="w-full bg-red-600 text-white p-3 rounded-lg mt-2 hover:bg-red-700 transition-colors duration-300"
                        >
                            Logout
                        </button>
                    </div>
                )}
                {user && !hasVoted && (
                    <form onSubmit={handleSubmit} className="mb-6">
                        <div className="flex flex-col items-center">
                            <select
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                className="w-full p-3 bg-gray-700 text-white border-2 border-gray-600 rounded-lg mb-4 text-center focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                            >
                                <option value="" className="bg-gray-800">Select your rating</option>
                                {[5, 4, 3, 2, 1].map(num => (
                                    <option key={num} value={num} className="bg-gray-800">
                                        {ratingEmojis[num]}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                            >
                                Submit Vote
                            </button>
                        </div>
                    </form>
                )}
                {hasVoted && <p className="text-center text-green-500 mb-4">Thank you for voting!</p>}
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-center text-green-500">Live Vote Results</h3>
                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map(rating => renderVoteBar(rating))}
                    </div>
                    <div className="text-center mt-4 text-gray-400">Total Votes: {totalVotes}</div>
                </div>
            </div>
        </div>
    );
}

export default App;