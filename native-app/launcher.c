#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>

// Aria Study Launcher — kills old node, starts fresh, opens browser

static pid_t child = 0;

void cleanup(int sig) {
    if (child > 0) { kill(child, SIGTERM); usleep(100000); kill(child, SIGKILL); }
    _exit(0);
}

int main() {
    signal(SIGINT, cleanup);
    signal(SIGTERM, cleanup);
    signal(SIGHUP, cleanup);
    signal(SIGPIPE, SIG_IGN);

    const char *home = getenv("HOME");
    if (!home || !home[0]) return 1;

    child = fork();
    if (child == 0) {
        // Child process — uses full paths so it works from Finder
        char cmd[4096];
        snprintf(cmd, sizeof(cmd),
            "export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\"%s/.local/node/bin\" && "
            "cd \"%s/Downloads/firstcc/personal-app\" && "
            "/usr/sbin/lsof -ti:3456 2>/dev/null | /usr/bin/xargs kill -9 2>/dev/null; "
            "true && "
            "\"%s/.local/node/bin/node\" server.js & "
            "SPID=$! && "
            "for i in 1 2 3 4 5 6 7 8 9 10 15; do "
            "  /usr/bin/curl -s http://127.0.0.1:3456 >/dev/null 2>&1 && break; "
            "  sleep 0.3; "
            "done && "
            "/usr/bin/open http://127.0.0.1:3456 "
            "&& wait $SPID",
            home, home, home);

        execl("/bin/bash", "bash", "-c", cmd, NULL);
        _exit(1);
    }

    int status;
    waitpid(child, &status, 0);
    return 0;
}
