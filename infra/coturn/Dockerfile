FROM coturn/coturn:latest

USER root

# Copy default configuration file and entrypoint script from correct build context path
COPY infra/coturn/turnserver.conf /etc/turnserver.conf
COPY infra/coturn/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
