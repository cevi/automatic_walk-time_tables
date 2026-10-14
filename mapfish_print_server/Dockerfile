FROM camptocamp/mapfish_print:4.0

# JVM and print job defaults, sized together:
#  - each parallel export at 508 dpi needs roughly 0.5 GiB of heap, so a 3 GiB
#    heap fits 5 parallel jobs (further jobs wait in the queue). With 10 jobs
#    and a 2 GiB heap the JVM ran out of memory and the jobs hung.
#  - without G1PeriodicGCInterval the JVM keeps the heap after a burst of
#    exports and never returns it to the host.
# Run the container with a memory limit of 4 GiB.
ENV CATALINA_OPTS="-Dfile.encoding=UTF-8 -Xmx3g -XX:G1PeriodicGCInterval=60000 -DmaxNumberOfRunningPrintJobs=5"

# add our custom config files / report templates
COPY ./swisstopo_config /usr/local/tomcat/webapps/ROOT/print-apps/swisstopo

EXPOSE 8080
