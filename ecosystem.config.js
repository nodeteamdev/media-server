module.exports = {
    apps: [{
        // set app name
        name: 'media-server',
        // pm2 start script
        script: 'dist/main.js --hostname 0.0.0.0',
        // forced app restart with memory leak
        max_memory_restart: '1100M',
        // count instances in cluster mode
        instances: 1,
        // graceful shutdown (milliseconds time)
        kill_timeout: 2000,

        // disable write logs
        pid_file: '/dev/null',
        out_file: '/dev/null',
        error_file: '/dev/null',
    }],
};
