#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#include <string.h>

// Aria Study Launcher
// Stays alive in dock, starts node server, opens browser.

static pid_t child_pid = 0;

void handle_signal(int sig) {
    if (child_pid > 0) {
        kill(child_pid, SIGTERM);
        usleep(200000);
        kill(child_pid, SIGKILL);
    }
    _exit(0);
}

int main() {
    // Block SIGPIPE so the process doesn't die from writing to closed pipes
    signal(SIGPIPE, SIG_IGN);
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    signal(SIGHUP, handle_signal);

    const char *home = getenv("HOME");
    if (!home) return 1;
    if (home[0] == 0) return 1;

    child_pid = fork();
    if (child_pid == 0) {
        // Child process: launch server + browser
        char cmd[2048];
        snprintf(cmd, sizeof(cmd),
            "cd \"%s/Downloads/firstcc/personal-app\" 2>/dev/null && "
            "lsof -ti:3000 | xargs kill -9 2>/dev/null; "
            "\"%s/.local/node/bin/node\" server.js >/dev/null 2>&1 & "
            "SPID=$!; "
            "for i in 1 2 3 4 5 6 7 8 9 10; do "
            "  curl -s http://127.0.0.1:3000 >/dev/null 2>&1 && break; "
            "  sleep 0.3; "
            "done; "
            "open \"http://127.0.0.1:3000\" 2>/dev/null; "
            "wait $SPID",
            home, home
        );
        execl("/bin/bash", "bash", "-c", cmd, NULL);
        _exit(1);
    }

    // Parent stays alive — dock icon persists
    int status = 0;
    waitpid(child_pid, &status, 0);
    return 0;
}
